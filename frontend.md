# Canary frontend integration guide

This document is the frontend contract for the Canary backend on `main`.
Canary is a FastAPI service. The frontend starts campaigns, displays live
progress, and renders persisted evidence. It does not call Backboard directly.

## Backend URL

```text
http://13.206.233.65
```

Use an environment variable in development and a server-side proxy in
production. The API token must never be placed in `VITE_*`, `NEXT_PUBLIC_*`, or
browser JavaScript.

```text
Authorization: Bearer <CANARY_API_TOKEN>
Content-Type: application/json
```

`GET /health` is the only unauthenticated endpoint. All other API routes require
the bearer token. A frontend server route should add the token before forwarding
requests to Canary.

## Main user flow

```text
Projects → verify target → create release/campaign → show live progress
         → display findings/evidence → show PASS, WARN, or BLOCK
```

The target is an independently hosted HTTP AI agent. Canary sends generated
adversarial prompts to it; the frontend never needs the target's model key.

## Health and status

```http
GET /health
GET /api/status
```

Health response:

```json
{"status":"healthy","service":"agent-canary-api"}
```

## Campaigns and SSE

Start a campaign with:

```http
POST /api/campaigns/run
```

Example request:

```json
{
  "target_url": "http://13.201.9.115/chat",
  "techniques": [
    "prompt-injection",
    "tool-abuse",
    "data-exfiltration",
    "privilege-escalation"
  ],
  "headers": {
    "Authorization": "Bearer <target-token>"
  }
}
```

The response is `text/event-stream`. Parse each `data: <json>` event. Important
event types are:

- `agent_state` — strategist, attacker, evaluator, reporter status changes.
- `log` — progress messages and elapsed time.
- `finding` — a confirmed or review finding.
- `campaign_complete` — final campaign summary.

Example completion payload:

```json
{
  "campaign_id": "campaign-...",
  "run_id": "a8f696de",
  "total_findings": 1,
  "critical_count": 1,
  "high_count": 0,
  "duration_seconds": 145,
  "findings": []
}
```

The `run_id` is the stable identifier used to load persisted evidence. A
campaign ID is generated for every stream and changes every time.

## Releases and differential results

The release API is the preferred product workflow:

```http
POST /api/projects
POST /api/projects/{project_id}/target/verify
POST /api/projects/{project_id}/releases
GET  /api/releases/{release_id}
GET  /api/releases/{release_id}/regressions
POST /api/projects/{project_id}/baselines/{release_id}/accept
POST /api/ci/releases
```

Release status is one of `queued`, `running`, `completed`, `failed`, or
`cancelled`. A completed release has a decision of `pass`, `warn`, or `block`.

The differential classifications are:

| Baseline | Candidate | Result |
|---|---|---|
| safe | vulnerable | regression |
| vulnerable | vulnerable | known |
| vulnerable | safe | resolved |
| safe | safe | clean |

Render the decision prominently. Do not derive it from the numeric score: the
configured gate policy decides PASS/WARN/BLOCK.

Typical release fields:

```ts
type Decision = "pass" | "warn" | "block";
type ReleaseStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

interface Release {
  release_id: string;
  project_id: string;
  commit_sha: string;
  environment: string;
  status: ReleaseStatus;
  decision: Decision | null;
  baseline_release_id: string | null;
  run_id: string | null;
  baseline_score: number | null;
  candidate_score: number | null;
  score_delta: number | null;
  coverage: Record<string, number>;
  summary: Record<string, unknown>;
  comparison: Record<string, unknown>;
}
```

## Run evidence

```http
GET /api/runs/{run_id}
GET /api/runs/{run_id}/findings
GET /api/runs/{run_id}/analysis-report
GET /api/runs/{run_id}/report-markdown
```

Evidence cards should show the attack prompt, target response, HTTP status and
latency, deterministic signals, evaluator verdict, confidence, severity,
taxonomy, and rationale. Do not make users inspect raw JSON to understand a
finding.

## LLM telemetry

All four backend agents use Backboard/OpenRouter with
`openai/gpt-5.6-luna`: Strategist, Attacker, Evaluator, and Reporter.

```http
GET /api/telemetry/llm-calls?limit=100
```

This authenticated endpoint returns provider/model, prompt and completion token
counts, total tokens, latency, status, retries, hashes, full prompt, full raw
response, errors, and timestamp. Treat prompts and responses as sensitive
security evidence. Do not display them by default to every user; use a gated
evidence view.

## Errors and loading states

Handle these statuses:

- `401` — missing or invalid API token.
- `403` — target or project is not authorized.
- `409` — target is not verified or the release state is invalid.
- `422` — malformed request or unsafe target URL.
- `429` — concurrency limit reached; retry with backoff.
- `500/503` — backend/provider failure; show a retryable error.

For a release, keep polling while it is queued/running and show the current
agent phase. A provider failure must be shown as failed or incomplete; never
render it as PASS.

## Local frontend proxy

The browser should call its own `/api` route. That route forwards to the Canary
URL and adds the server-side token:

```ts
const response = await fetch(`${process.env.CANARY_API_URL}${path}`, {
  ...init,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CANARY_API_TOKEN}`,
    ...(init.headers ?? {})
  }
});
```

Never expose `CANARY_API_TOKEN` in the browser bundle.
