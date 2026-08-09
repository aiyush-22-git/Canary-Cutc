# Canary backend → frontend integration guide

Last verified: 2026-08-09 · branch `backend` · deployed commit `32d2fae`

Live demo API: `http://13.206.233.65`<br>
Live CompanyAgent target: `http://13.201.9.115/chat`

These are hackathon HTTP endpoints. Use an HTTPS reverse proxy before exposing
them to real users.

This document describes the backend that is currently running on the `backend`
branch. It is the contract for connecting a React/Next/Vite frontend to Canary.

## 1. Runtime configuration

Set the frontend server-side API base URL to:

```text
http://13.206.233.65
```

For local development use the URL of the FastAPI process, normally
`http://localhost:8001`.

The backend currently requires a bearer token on every route except `/health`:

```http
Authorization: Bearer <API_SECRET_KEY>
```

`API_SECRET_KEY` is a server credential. Do not put it in a `VITE_*`, `NEXT_PUBLIC_*`,
or other browser-bundled variable. A production frontend should call the backend
through a same-origin server route/proxy that adds the header. GitHub OAuth/session
handling is not implemented inside this FastAPI service. Add OAuth in the frontend
server or an auth gateway, then have that trusted server call Canary with the
server-side bearer token. CI uses a separate project-scoped token.

Backend CORS is controlled by `FRONTEND_ORIGINS` (comma-separated origins). It does
not use cookies (`allow_credentials=false`).

```ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_CANARY_API_URL!;

export async function canaryFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      // Only do this in a trusted server-side proxy, never in browser code.
      Authorization: `Bearer ${process.env.CANARY_API_SECRET}`,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Canary request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
```

For browser-only Vite code, proxy `/api` through the frontend host and attach the
token server-side. Never use `VITE_API_TOKEN` or `NEXT_PUBLIC_*` for a Canary
secret.

## 2. Health and status

`GET /health` is unauthenticated and is suitable for an initial connectivity
check. `GET /api/status` is authenticated and reports database/report state.

```json
// GET /health
{"status":"healthy","service":"agent-canary-api"}
```

## 3. Primary CUTC workflow

The release workflow is the preferred frontend experience:

```text
create project
→ verify target ownership
→ create candidate release
→ poll release
→ show PASS/WARN/BLOCK
→ show differential evidence
→ accept a completed release as baseline
```

### Create a project

`POST /api/projects` → `201`

```json
{
  "name": "CompanyAgent",
  "endpoint": "https://preview.example.com/chat",
  "environment": "preview",
  "request_template": "{\"message\":\"{{PROMPT}}\"}",
  "response_path": "response",
  "strategies": [
    "prompt_injection",
    "indirect_injection",
    "tool_misuse",
    "sensitive_data_exposure",
    "authorization_boundary",
    "retrieval_poisoning"
  ],
  "gate": {
    "block_on": ["critical", "high"],
    "warn_on": ["medium", "low"],
    "max_new_blocking_findings": 0
  }
}
```

The `{{PROMPT}}` placeholder must be present as a quoted JSON string. The endpoint
must be an HTTP(S) URL and must not resolve to localhost, private, link-local,
reserved, multicast, or cloud metadata addresses.

Project response shape:

```ts
export interface Project {
  project_id: string;
  name: string;
  slug: string;
  repository: string | null;
  environment: string;
  endpoint: string;
  request_template: string;
  response_path: string | null;
  strategies: string[];
  gate: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}
```

Use `GET /api/projects` for the project list and
`GET /api/projects/{project_id}` for the detail page.

### Verify reachability

`POST /api/projects/verify-target` probes a target without registering it:

```json
{
  "endpoint": "https://preview.example.com/chat",
  "request_template": "{\"message\":\"{{PROMPT}}\"}",
  "response_path": "response"
}
```

Response:

```json
{
  "reachable": true,
  "status_code": 200,
  "response_path_detected": true
}
```

For project registration, the target must prove ownership. Generate a random token
of at least 16 characters and have the CompanyAgent return it in either the
`X-Canary-Verification` response header or a JSON `canary_verification` field.
Then call `POST /api/projects/{project_id}/target/verify`:

```json
{
  "endpoint": "https://preview.example.com/chat",
  "request_template": "{\"message\":\"{{PROMPT}}\"}",
  "response_path": "response",
  "verification_token": "a-random-one-time-token"
}
```

The response is:

```json
{"verified":true,"target_id":"...","project_id":"...","environment":"preview"}
```

A release cannot start until the target is verified for the release environment.

### Start a release

`POST /api/projects/{project_id}/releases` → `202`

```json
{"commit_sha":"abcd1234","environment":"preview"}
```

Response:

```ts
export interface Release {
  release_id: string;
  project_id: string;
  commit_sha: string;
  ref: string | null;
  event_name: string | null;
  is_baseline: boolean;
  environment: string;
  run_id: string | null;
  baseline_replay_run_id: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  decision: "pass" | "warn" | "block" | null;
  baseline_release_id: string | null;
  finding_ids: string[];
  summary: Record<string, unknown>;
  comparison: Record<string, unknown>;
  baseline_score: number | null;
  candidate_score: number | null;
  score_delta: number | null;
  coverage: Coverage;
  failure_code: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface Coverage {
  percentage?: number;
  configured_strategies?: number;
  attempted_strategies?: number;
  successful_strategies?: number;
  failed_strategies?: number;
  skipped_strategies?: number;
  planned_attack_cases?: number;
  attempted_attack_cases?: number;
  completed_attack_cases?: number;
}
```

Coverage measures executed security-test surface, not the number of findings. A
strategy that completes safely still contributes to coverage.

Poll `GET /api/releases/{release_id}` every 2–5 seconds until `status` is
`completed`, `failed`, or `cancelled`. Do not infer the decision from scores;
use the server-provided `decision` field.

Use `GET /api/projects/{project_id}/releases` for the release table.

### Accept a baseline

There is no implicit safe baseline. After a completed assessment, the user must
explicitly accept it:

`POST /api/projects/{project_id}/baselines/{release_id}/accept?reason=Reviewed%20by%20team`

The release must be completed. List environment-specific accepted baselines with:

`GET /api/projects/{project_id}/baselines`

### Inspect evidence

`GET /api/releases/{release_id}/regressions` returns the compact evidence-diff list.
Each item has:

```ts
export type Classification = "regression" | "known" | "resolved" | "clean" | "indeterminate";

export interface SecurityRegression {
  regression_id: string;
  attack_case_id: string;
  finding_id: string | null;
  classification: Classification;
  severity: "critical" | "high" | "medium" | "low" | "info" | string;
  baseline_verdict: string | null;
  candidate_verdict: string | null;
  baseline_evidence: Record<string, unknown>;
  candidate_evidence: Record<string, unknown>;
  reason: string | null;
}
```

For the full release screen use `GET /api/releases/{release_id}/report`. It returns
`release`, `project`, `findings`, and `regressions`. The evidence object includes
the attack payload, target response, tool trace, deterministic detector hits, LLM
judge score/verdict, confidence, rationale, and taxonomy.

`GET /api/releases/{release_id}/report.md` returns the same report as plain text
for a download button.

Use `indeterminate` as a manual-review/WARN state. It means one side of an
equivalent attack case did not produce a conclusive execution; it is not proof of
a vulnerability and must not be rendered as one.

## 4. Legacy campaign UI (live SSE)

The existing campaign view remains available at `POST /api/campaigns/run`. It is
useful for a live attack console, but it is not the preferred release-gate screen.

Request:

```json
{
  "target_url": "https://preview.example.com/chat",
  "techniques": ["prompt-injection", "tool-abuse", "data-exfiltration"],
  "headers": {"X-Agent-Key":"..."},
  "request_template": "{\"message\":\"{{PROMPT}}\"}",
  "response_path": "response"
}
```

The response is `text/event-stream`. Every message is a line in this format:

```text
data: {"type":"...","payload":{...},"timestamp":"..."}

```

Supported event types:

- `log`: `{ level, message }`
- `agent_state`: `{ agent_id, status, active_edge? }`
- `finding`: finding payload for a confirmed attack
- `campaign_complete`: final `{ campaign_id, run_id, total_findings, critical_count, high_count, duration_seconds, findings }`

The server generates a fresh `campaign_id` for every stream. Do not reuse a client
campaign ID as the canonical identifier. Use `EventSource` only for GET endpoints;
for this POST stream use `fetch()` and parse the response body incrementally, or use
an SSE POST helper.

## 5. Findings and historical runs

Legacy run endpoints are still available:

- `POST /api/runs` → `{ run_id, status, target_id }`
- `GET /api/runs/{run_id}` → run metadata and raw attacks
- `GET /api/runs/{run_id}/analysis-report` → frontend-oriented report shape
- `GET /api/runs/{run_id}/findings`
- `GET /api/runs/{run_id}/report-markdown`

Findings:

- `GET /api/findings?target_id=&asi_class=&severity=&status=&page=1&page_size=50`
- `GET /api/findings/{finding_id}`
- `GET /api/findings/{finding_id}/attempts`
- `PUT /api/findings/{finding_id}/status`

Finding status updates require a JSON body such as:

```json
{"status":"resolved","reviewer_id":"user-id","rationale":"Guardrail deployed"}
```

Coverage/trends:

- `GET /api/targets/{target_id}/coverage`
- `GET /api/targets/{target_id}/trends?days=30`
- `GET /api/incidents`

## 6. Project-scoped CI tokens

The dashboard/admin bearer token can create a project-scoped token:

`POST /api/projects/{project_id}/tokens`

```json
{"scopes":["release:create","release:read"]}
```

The raw token is returned once. Store it as a GitHub Actions secret, never in the
frontend. It is accepted only by `POST /api/ci/releases`; all dashboard routes
require the server API secret.

The CI request includes `repository`, `commit_sha`, `ref`, `event_name`,
`environment`, `endpoint`, `request_template`, `response_path`, `strategies`, and
`gate`. The action polls the returned `release_id` and fails the workflow only
when `decision === "block"`; `warn` remains a successful workflow with a warning
summary.

## 7. Live execution and cost behavior

Candidate releases run the configured LLM Strategist, Attacker, Evaluator, and
Reporter agents. With an accepted baseline, Canary replays persisted attack cases
against both candidate and baseline. The baseline side is replay-only: it does
not launch a second exploratory Strategist campaign, avoiding duplicate hosted
model calls while keeping the comparison equivalent.

The deployed service uses bounded transport retries (`MAX_RETRIES=1`) and a
120-second request timeout. Poll every 2–5 seconds and show a running state until
the server returns `completed`, `failed`, or `cancelled`. A release can be `WARN`
when an LLM execution is indeterminate; do not silently convert that to `PASS`.

## 8. Error handling

Frontend error handling should use the HTTP status and `detail` field:

- `401`: missing/invalid bearer token
- `403`: target or project-token scope is not authorized
- `404`: project, release, run, or finding does not exist
- `409`: target not verified, baseline mismatch, illegal state transition, or no valid baseline
- `422`: invalid URL, request template, commit SHA, or verification proof
- `429`: concurrent execution limit reached; retry with backoff
- `503`: authentication or release queue is unavailable

Never display raw stack traces or secret-bearing request headers. Preserve the
server's `failure_code` and `detail` in an operator-visible error state.

## 9. Suggested frontend pages

1. **Projects** — list projects, environment, verified endpoint, active baseline.
2. **Project detail** — target verification, strategies/gate configuration, recent releases.
3. **Release detail** — decision, baseline/candidate scores, delta, coverage, classification counts, and evidence cards.
4. **Findings** — filterable canonical findings and lifecycle status.
5. **Live campaign** — optional SSE view for agent states and attack logs.

The release detail page should render evidence as a comparison, not as a raw JSON
dump:

```text
BASELINE: request rejected
CANDIDATE: unauthorized action executed
ATTACK: <payload>
EVALUATOR: <rationale>
DETECTORS: <hits and scores>
TAXONOMY: <ASI / ATLAS>
```

## 10. Local frontend smoke test

```bash
curl http://localhost:8001/health
curl -H "Authorization: Bearer $API_SECRET_KEY" http://localhost:8001/api/status
```

For the deployed API:

```bash
curl http://13.206.233.65/health
curl -H "Authorization: Bearer $API_SECRET_KEY" http://13.206.233.65/api/status
```

Keep `API_SECRET_KEY`, `TOKEN_PEPPER`, `BACKBOARD_API_KEY`, and project CI tokens
outside source control and outside browser JavaScript.
