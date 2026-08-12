import type { SSEEvent } from './types'

// Backend connection — empty string = relative URL, handled by nginx proxy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env as Record<string, string>
export const API_BASE = _env.VITE_API_URL || ''
export const API_TOKEN = _env.VITE_API_TOKEN || ''

export const authHeader = (): Record<string, string> => ({
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
})

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeader(), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.detail ?? '' } catch { /* body wasn't JSON */ }
    throw new ApiError(detail || `Backend responded ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

// ─── Runs ───────────────────────────────────────────────────────────────────
export const getRun = (runId: string) => apiFetch<unknown>(`/api/runs/${runId}`)
export const getRunReportMarkdown = (runId: string) => apiFetch<{ markdown: string }>(`/api/runs/${runId}/report-markdown`)

// ─── Release dashboard (database-backed) ───────────────────────────────────
export interface ProjectRecord {
  project_id: string
  name: string
  slug: string
  repository?: string | null
  environment: string
  endpoint: string
  strategies: string[]
  gate: Record<string, unknown>
  created_at?: string | null
  updated_at?: string | null
}

export interface ReleaseRecord {
  release_id: string
  project_id: string
  commit_sha: string
  ref?: string | null
  environment: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string
  decision?: 'pass' | 'warn' | 'block' | null
  baseline_release_id?: string | null
  run_id?: string | null
  baseline_replay_run_id?: string | null
  baseline_score?: number | null
  candidate_score?: number | null
  score_delta?: number | null
  coverage?: { percentage?: number; [key: string]: unknown }
  summary?: { regression_counts?: Record<string, number>; [key: string]: unknown }
  comparison?: Record<string, unknown>
  created_at?: string | null
  completed_at?: string | null
}

export interface ReleaseRegression {
  regression_id: string
  attack_case_id: string
  classification: 'regression' | 'known' | 'resolved' | 'clean' | 'indeterminate' | string
  severity?: string | null
  baseline_verdict?: string | null
  candidate_verdict?: string | null
  baseline_evidence?: Record<string, unknown>
  candidate_evidence?: Record<string, unknown>
  reason?: string | null
}

export interface ReleaseReport {
  release: ReleaseRecord
  project: ProjectRecord
  regressions: ReleaseRegression[]
  findings: Array<Record<string, unknown>>
}

export interface LlmTelemetryRecord {
  id: number
  agent: string
  deployment: string
  latency_seconds: number
  status_code?: number | null
  retry_count: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  input_hash: string
  output_hash: string
  prompt?: string | null
  response?: string | null
  error?: string | null
  timestamp?: string | null
}

export const getProjects = () => apiFetch<ProjectRecord[]>('/api/projects')
export const getProjectReleases = (projectId: string) =>
  apiFetch<ReleaseRecord[]>(`/api/projects/${encodeURIComponent(projectId)}/releases`)
export const getReleaseReport = (releaseId: string) =>
  apiFetch<ReleaseReport>(`/api/releases/${encodeURIComponent(releaseId)}/report`)
export const getLlmTelemetry = (limit = 100) =>
  apiFetch<LlmTelemetryRecord[]>(`/api/telemetry/llm-calls?limit=${limit}`)

// ─── Findings ───────────────────────────────────────────────────────────────
export const getFindings = (query: string) => apiFetch<unknown[]>(`/api/findings?${query}`)
export const getFinding = (findingId: string) => apiFetch<unknown>(`/api/findings/${findingId}`)
export const getFindingAttempts = (findingId: string) => apiFetch<unknown[]>(`/api/findings/${findingId}/attempts`)
export const updateFindingStatus = (findingId: string, body: Record<string, string | boolean>) =>
  apiFetch<unknown>(`/api/findings/${findingId}/status`, { method: 'PUT', body: JSON.stringify(body) })

// ─── Incidents ──────────────────────────────────────────────────────────────
export const getIncidents = () => apiFetch<unknown[]>('/api/incidents')

// ─── Campaigns (SSE) ────────────────────────────────────────────────────────
export interface CampaignRunPayload {
  campaign_id: string
  target_url: string
  techniques: string[]
  headers?: Record<string, string>
  request_template?: string
  response_path?: string
}

export async function runCampaignSSE(
  payload: CampaignRunPayload,
  onEvent: (event: SSEEvent) => void,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/campaigns/run`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(payload),
    signal: opts?.signal,
  })

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.detail ?? '' } catch { /* body wasn't JSON */ }
    throw new ApiError(detail || `Backend responded ${res.status}`, res.status)
  }
  if (!res.body) throw new Error('No SSE stream body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // keep incomplete last line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        onEvent(JSON.parse(line.slice(6)))
      } catch { /* skip malformed */ }
    }
  }
}
