# AWS hosted deployment

The hosted Canary control plane is split into two ECS Fargate services using
the same `cyber-redteam-foundry` image:

* `canary-api` runs FastAPI behind an HTTPS Application Load Balancer.
* `canary-worker` runs the RQ worker and owns release execution after the API
  has committed the release row.

Persistent services are RDS PostgreSQL (`DATABASE_URL`) and ElastiCache Redis
(`REDIS_URL`). Store both values in AWS Secrets Manager; do not put credentials
in task definitions, Git, or browser/Vercel environment variables. The
Backboard API key (`BACKBOARD_API_KEY`), API bearer secret (`API_SECRET_KEY`),
and token pepper (`TOKEN_PEPPER`) must also be injected as ECS secrets. The ECS
task execution role needs `secretsmanager:GetSecretValue` for those exact
secret ARNs; the application task role does not need Bedrock permissions or
any LLM-provider credential. Backboard calls leave the private subnet through
the approved NAT/egress path. CloudWatch receives container logs. Keep the
ALB and data services in private subnets according to the deployment's network
policy.

## Deployment order

1. Create an ECR repository and build/push `cyber-redteam-foundry/Dockerfile`.
   The same image runs the API and the RQ worker; no target-agent container is
   bundled in this repository.
2. Provision RDS PostgreSQL, ElastiCache Redis, an ECS Fargate cluster, task
   execution/task roles, security groups, and an HTTPS ALB.
3. Create Secrets Manager secrets for `DATABASE_URL`, `REDIS_URL`,
   `BACKBOARD_API_KEY`, `API_SECRET_KEY`, and `TOKEN_PEPPER`. Use a generated
   high-entropy value for the latter two; never commit or print their values.
4. Run `migrations/001_cutc_release_domain.sql` against the RDS database using
   the deployment migration job or an approved migration runner. The API and
   worker do not perform additive PostgreSQL column migrations on startup;
   schema changes belong in this migration path.
5. Render the task definition templates in this directory with the real ECR
   image, AWS region, and secret ARNs, then register one API task definition
   and one worker task definition. Keep the rendered files out of Git.
6. Deploy the API service with `RELEASE_EXECUTION_MODE=rq` and the worker
   service with the same `DATABASE_URL`, `REDIS_URL`, `RELEASE_QUEUE_NAME`,
   Backboard provider/model, and authentication configuration.
7. Configure the ALB health check to `GET /health` and set
   `FRONTEND_ORIGINS` to the Vercel dashboard origin.

For local development, leave `RELEASE_EXECUTION_MODE=thread` and use the
existing SQLite path. The same image can still run the optional local Redis
worker from `docker-compose.yml`.

## Operational invariants

* The API enqueues only after the release transaction commits.
* RQ job IDs are deterministic per release, so duplicate delivery is safe at
  the release execution boundary.
* Retries are bounded by `MAX_RETRIES`/`RELEASE_JOB_TIMEOUT_SECONDS` and final
  failures are persisted as release failures.
* Scale API and worker services independently; set the worker service's
  desired count and RQ concurrency to the approved campaign limit.
* Apply network egress controls in addition to application-level target URL
  validation. Canary should reach only explicitly verified targets.
* Backboard is the only configured LLM gateway for this deployment. Set
  `BACKBOARD_LLM_PROVIDER` and `BACKBOARD_MODEL_NAME` as non-secret task
  environment variables if the deployment needs a different supported pair;
  the API key remains a secret.

The JSON files are templates, not ready-to-register production definitions:
replace `${...}` placeholders during deployment and keep secret values in
Secrets Manager. ECS `secrets[].valueFrom` should reference a secret ARN (or a
JSON-key ARN if using a JSON secret). Do not place a literal API key in the
rendered task definition or pass it as a command-line argument.

## Required template values

`ECR_IMAGE`, `BACKBOARD_BASE_URL, BACKBOARD_LLM_PROVIDER, and BACKBOARD_MODEL_NAME`, `ECS_EXECUTION_ROLE_ARN`, `CANARY_TASK_ROLE_ARN`,
`BACKBOARD_LLM_PROVIDER`, `BACKBOARD_MODEL_NAME`,
`FRONTEND_ORIGINS`, `DATABASE_URL_SECRET_ARN`, `REDIS_URL_SECRET_ARN`,
`BACKBOARD_API_KEY_SECRET_ARN`, `API_SECRET_KEY_SECRET_ARN`, and
`TOKEN_PEPPER_SECRET_ARN` are deployment-time values. `FRONTEND_ORIGINS` is
the exact HTTPS Vercel origin(s), comma-separated; it is not a credential.

The API task exposes port 8001 only to the ALB security group. The worker has
no inbound listener. Permit worker egress to RDS, Redis, Backboard's HTTPS
endpoint, and only the verified agent targets required by the deployment.
