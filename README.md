# Canary-Cutc

Backend-only foundation for the CUTC 2026 Agent Canary project. This repository is being built incrementally on the `backend` branch. The `main` branch is intentionally left untouched.

## Current state

The repository currently contains the Canary red-team backend in [`cyber-redteam-foundry/`](cyber-redteam-foundry/). The frontend package was intentionally removed from this backend repository.

Canary is an HTTP-based security testing service for AI agents. It preserves the existing multi-agent pipeline:

```text
Strategist -> parallel Attackers -> Evaluator -> Reporter
```

The backend currently includes:

- FastAPI API for projects, targets, releases, campaigns, findings, and reports
- LangGraph orchestration with parallel attack branches
- HTTP target adapter for testing externally hosted agents
- Backboard LLM gateway integration for Strategist, Attacker, Evaluator, and Reporter
- deterministic detector signals combined with LLM evaluation
- ASI/ATLAS taxonomy and structured evidence
- differential release evaluation and baseline regression classification
- target URL validation and project-scoped CI token primitives
- SQLite local persistence, with PostgreSQL/Redis/RQ configuration for hosted execution
- release-gate and GitHub Action support in the source tree

The active LLM configuration is server-side Backboard. No provider key belongs in frontend code or committed files. The active runtime has no Bedrock or in-process target-agent path; all agent model calls use Backboard.

## Repository layout

```text
.
└── cyber-redteam-foundry/
    ├── src/cyberredteam/       # FastAPI service, agents, graph, storage, security
    ├── src/canary/             # release execution primitives
    ├── configs/                 # models, policies, attack and taxonomy config
    ├── prompts/                 # agent system prompts
    ├── migrations/              # release-domain database migration
    ├── tests/                   # backend test suite
    └── Dockerfile
```

## Local setup

From the repository root:

```bash
cd cyber-redteam-foundry
uv sync --extra dev
cp .env.example .env
```

Set `BACKBOARD_API_KEY` in the server environment. The key is created in Backboard Dashboard → Settings → API Keys. Keep it server-side. The default provider/model are:

```dotenv
BACKBOARD_LLM_PROVIDER=openrouter
BACKBOARD_MODEL_NAME=moonshotai/kimi-k2.6
```

For local-only development, configure `DATABASE_URL` empty to use SQLite and keep `RELEASE_EXECUTION_MODE=thread`. Do not enable `ALLOW_PRIVATE_TARGETS` in a hosted deployment.

Start the API:

```bash
cd cyber-redteam-foundry
uv run uvicorn cyberredteam.api:app --app-dir src --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Core release flow

1. Create a project.
2. Verify an HTTP target and store the ownership proof.
3. Run an initial release assessment.
4. Accept that release explicitly as the environment baseline.
5. Submit a candidate release with the candidate commit and target URL.
6. Canary executes AI-generated attack branches against the candidate.
7. Relevant attack cases are replayed against the accepted baseline.
8. The differential engine classifies each case as `regression`, `known`, `resolved`, or `clean`.
9. The policy engine returns `pass`, `warn`, or `block` and persists evidence.

The API exposes release and regression data for CI polling and GitHub job summaries. See the detailed backend documentation in [`cyber-redteam-foundry/README.md`](cyber-redteam-foundry/README.md).

## Important endpoints

- `GET /health`
- `POST /api/projects`
- `POST /api/projects/{project_id}/target/verify`
- `POST /api/projects/{project_id}/releases`
- `POST /api/ci/releases`
- `GET /api/releases/{release_id}`
- `GET /api/releases/{release_id}/regressions`
- `POST /api/projects/{project_id}/baselines/{release_id}/accept`

## Tests

```bash
cd cyber-redteam-foundry
uv run pytest
```

The suite covers the agent graph, API lifecycle, Backboard adapter, differential classification, gate policy, coverage, target SSRF validation, token boundaries, release execution, and storage.

## Scope for the next steps

This branch is intentionally backend-only. The next implementation steps will focus on making the release-gate workflow fully reproducible, tightening the API/storage boundaries, and validating the CompanyBot target separately. Frontend and deployment work are out of scope for this repository until requested.

## Security

- Never commit `.env` files, API keys, AWS credentials, or CI tokens.
- Use project-scoped CI tokens for GitHub Actions.
- Keep `API_SECRET_KEY`, `TOKEN_PEPPER`, and `BACKBOARD_API_KEY` server-side.
- Verify ownership before Canary sends requests to a target.
- Use network-level egress controls in production in addition to application URL validation.
