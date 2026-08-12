# Agent Canary

[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vite.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8.svg)](https://tailwindcss.com/)
[![nginx](https://img.shields.io/badge/nginx-1.25--alpine-009639.svg)](https://nginx.org/)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ed.svg)](https://www.docker.com/)

Live frontend for **Agent Canary**, connected to the AWS-hosted **Cyber Red Team Foundry** FastAPI backend. The landing page, Red Team view, and Findings view read persisted release security data over the server-side Vercel proxy.

Open the deployed frontend at [canary-coral.vercel.app](https://canary-coral.vercel.app/).

Built with React 19 + TypeScript + Vite 8, styled with TailwindCSS and JetBrains Mono, and served via nginx in container deployments.

---

## Pages

### Landing page

The original cinematic landing page is the primary entry point. Its console is
live: release decision, coverage, strategy count, LLM calls, token totals,
project, target, and persisted evidence are loaded from AWS.

The `Run Security Check` control submits a candidate commit SHA to the release
gate. It does not deploy code; the backend attacks the configured candidate,
replays the accepted baseline, and persists the comparison.

### FindingsPage — `/findings`

Database-backed cross-release outcomes. It filters `regression`, `known`,
`resolved`, `clean`, and `indeterminate` classifications and expands each
result to show its attack prompt, verdicts, and classification rationale.

### RedTeamPage — `/redteam`

Database-backed differential evidence browser. It shows projects, security
checks, PASS/WARN/BLOCK decisions, scores, coverage, attack prompts, baseline
responses, candidate responses, evaluator rationale, and classification for
every persisted attack case.

---

## Source Layout

```
canary/
├── index.html
├── vite.config.ts           # /api proxy → http://localhost:8001 (dev)
├── tailwind.config.js
├── nginx.conf               # /api/* → redteam-backend:8001 (prod), SSE-optimized
├── Dockerfile               # Multi-stage: node build → nginx serve
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx              # View switch: home, findings, redteam
    ├── components/
    │   ├── Navbar.tsx
    │   ├── Hero.tsx
    ├── lib/
    │   ├── api.ts                  # single client for every backend endpoint
    │   ├── techniques.ts           # attack technique catalogue
    │   └── types.ts                # shared domain types (Phase, FindingPayload, ...)
    └── pages/
        ├── FindingsPage.tsx
        └── RedTeamPage.tsx
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite 8 |
| Styling | TailwindCSS 3 |
| Typography | JetBrains Mono |
| Linting | Oxlint |
| Production server | nginx 1.25-alpine |

No external UI component library. All UI is hand-built with Tailwind utility classes.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Optional backend base URL for local development | `""` (relative proxy) |
| `VITE_API_TOKEN` | Optional local-development bearer token | — |

When `VITE_API_URL` is empty (the default), all `/api/*` requests are relative and nginx routes them to `redteam-backend:8001`. In dev, Vite's proxy handles the same routing to `http://localhost:8001`.

The hosted Vercel deployment uses server-only `CANARY_API_URL` and
`CANARY_API_TOKEN` variables in its proxy. The browser never receives the
backend credential.

---

## nginx SSE Configuration

The production nginx config applies the following settings on the `/api/campaigns/run` SSE route so events are not buffered:

```
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
add_header X-Accel-Buffering no;
```

Without these, nginx's default response buffering will hold SSE frames until the buffer fills, breaking the live topology animation and log stream.

---

## Development

```bash
npm install
npm run dev        # http://localhost:5173
```

Create `.env.local` with `VITE_API_TOKEN` only when connecting directly to a development backend. Production uses the server-side Vercel proxy.

---

## Production Build

```bash
npm run build      # outputs to dist/
```

Type-checking (`tsc -b`) runs before bundling. Fix all type errors before deploying.

---

## Docker

Multi-stage build: Node 20 builds the static assets, nginx 1.25-alpine serves them.

```bash
docker build -t canary-frontend \
  --build-arg VITE_API_URL="" \
  --build-arg VITE_API_TOKEN="your-token" \
  .
```

Or bring up the full stack from the repo root:

```bash
docker compose up -d --build
```

The container serves the SPA on port **8000** and proxies `/api/*` to `redteam-backend:8001`.

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Dev server with HMR |
| `build` | `tsc -b && vite build` | Type-check + bundle |
| `lint` | `oxlint` | Static analysis |
| `preview` | `vite preview` | Preview production build locally |

---

## API Surface

All requests are authenticated with `Authorization: Bearer <VITE_API_TOKEN>`. Every route below is wrapped in `src/lib/api.ts`.

| Method | Endpoint | Used by |
|---|---|---|
| `GET` | `/api/status` | health check |
| `GET` | `/api/runs/{run_id}` | RedTeamPage |
| `GET` | `/api/runs/{run_id}/report-markdown` | RunAuditPage |
| `GET` | `/api/findings` | FindingsPage |
| `GET` | `/api/findings/{id}` | FindingsPage |
| `GET` | `/api/findings/{id}/attempts` | FindingsPage |
| `PUT` | `/api/findings/{id}/status` | FindingsPage |
| `GET` | `/api/incidents` | RedTeamPage |
| `POST` | `/api/campaigns/run` (SSE) | RunAuditPage |
