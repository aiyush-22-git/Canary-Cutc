# Canary Backend

Canary is a backend service that tests AI agents for security problems.
It sends adversarial prompts to an agent over HTTP, records the response, and
uses separate AI agents to decide whether the response shows a vulnerability.

This repository contains only the backend. The frontend and the target agent
are separate applications.

## How it works

```text
HTTP request
    ↓
FastAPI API
    ↓
Strategist chooses the attack plan
    ↓
Parallel attackers generate adversarial prompts
    ↓
HTTP target agent receives the prompts
    ↓
Evaluator checks the responses and evidence
    ↓
Reporter writes a Markdown and JSON report
```

Canary never treats an attacker response as proof of a vulnerability. The
Evaluator makes the final decision using the target response, detector signals,
and an LLM judge.

## Main components

- **FastAPI** — HTTP API, authentication, campaigns, releases, findings, and reports.
- **LangGraph** — coordinates the Strategist, parallel Attackers, Evaluator, and Reporter.
- **Backboard** — provides the LLM calls for all four Canary agents.
- **HTTP target adapter** — tests independently hosted agents without importing their code.
- **SQLite/SQLAlchemy** — stores campaigns, attacks, traces, verdicts, findings, and telemetry.
- **Differential engine** — compares a candidate release with an accepted baseline.

## Backboard configuration

The default model is Luna 5.6 through OpenRouter:

```dotenv
BACKBOARD_API_KEY=your_key
BACKBOARD_BASE_URL=https://app.backboard.io/api
BACKBOARD_LLM_PROVIDER=openrouter
BACKBOARD_MODEL_NAME=openai/gpt-5.6-luna
```

The API key must remain server-side. Do not put it in frontend code, commit it
to Git, or include it in logs.

## Local setup

```bash
cd cyber-redteam-foundry
uv sync --extra dev
cp .env.example .env
```

Fill in `BACKBOARD_API_KEY` and the API authentication values in `.env`, then
start the service:

```bash
uv run uvicorn cyberredteam.api:app --app-dir src --host 0.0.0.0 --port 8000
```

Check that it is running:

```bash
curl http://localhost:8000/health
```

## API flow

For a normal campaign, send an authenticated request to:

```text
POST /api/campaigns/run
```

The request includes the target HTTP URL, selected attack techniques, and any
server-side target authorization header. The response is an SSE stream with
agent status, attack progress, findings, and a final campaign summary.

For release testing, Canary can:

1. Register and verify a target.
2. Run an initial assessment.
3. Accept that release as a baseline.
4. Test a candidate release.
5. Replay equivalent attacks against the baseline.
6. Classify each case as `regression`, `known`, `resolved`, or `clean`.
7. Return a policy decision: `pass`, `warn`, or `block`.

Important release endpoints include:

```text
POST /api/projects
POST /api/projects/{project_id}/target/verify
POST /api/projects/{project_id}/releases
POST /api/ci/releases
GET  /api/releases/{release_id}
GET  /api/releases/{release_id}/regressions
```

## Telemetry

Every LLM call is persisted in `llm_calls`. Stored information includes the
complete prompt, raw response, provider/model, HTTP status, retry count,
latency, prompt/completion/total token counts, hashes, errors, and timestamp.
If the provider does not return token usage, Canary stores a transparent
text-length estimate.

Authenticated telemetry endpoint:

```text
GET /api/telemetry/llm-calls?limit=100
```

Prompts and responses can contain sensitive security evidence, so this endpoint
requires the API bearer token.

## Repository layout

```text
cyber-redteam-foundry/
├── src/cyberredteam/   # FastAPI service, agents, graph, storage, security
├── configs/             # Model and security configuration
├── prompts/             # System prompts for the four agents
├── migrations/          # Database migrations
└── tests/               # Backend tests
```

## Tests

```bash
cd cyber-redteam-foundry
uv run pytest
```

Tests cover the agent graph, HTTP target execution, Backboard adapter,
differential classification, release lifecycle, gate policy, target validation,
authentication boundaries, storage, and telemetry.

## Security notes

- Only test agents you own or are explicitly authorized to test.
- Target URLs are validated to reduce SSRF risk.
- Keep API keys, project tokens, and target credentials server-side.
- Use HTTPS and network-level outbound egress controls in production.
- Do not expose raw prompt/response telemetry to unauthenticated users.
