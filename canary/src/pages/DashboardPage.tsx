import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Navbar from '../components/Navbar'
import { createProjectRelease, getLlmTelemetry, getProjects, getProjectReleases, getReleaseReport } from '../lib/api'
import type { LlmTelemetryRecord, ProjectRecord, ReleaseRecord, ReleaseReport } from '../lib/api'

interface DashboardPageProps {
  onRunAudit: () => void
  onFindings: () => void
  onRedTeam: () => void
}

const decisionClass: Record<string, string> = {
  pass: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  warn: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  block: 'text-red-300 border-red-400/40 bg-red-500/15',
}

function shortId(value?: string | null): string {
  return value ? `${value.slice(0, 8)}…` : '—'
}

function formatTime(value?: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-white/10 bg-white/[0.025] px-4 py-3">
      <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}

export default function DashboardPage({ onRunAudit, onFindings, onRedTeam }: DashboardPageProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [releases, setReleases] = useState<ReleaseRecord[]>([])
  const [selectedRelease, setSelectedRelease] = useState<ReleaseReport | null>(null)
  const [telemetry, setTelemetry] = useState<LlmTelemetryRecord[]>([])
  const [showReleaseForm, setShowReleaseForm] = useState(false)
  const [commitSha, setCommitSha] = useState('')
  const [submittingRelease, setSubmittingRelease] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (requestedProjectId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const projectRows = await getProjects()
      setProjects(projectRows)
      let activeProjectId = requestedProjectId || projectId
      let releaseRows: ReleaseRecord[] | undefined
      if (!activeProjectId && projectRows.length) {
        const releaseGroups = await Promise.all(projectRows.map((item) => getProjectReleases(item.project_id)))
        const mostRecentIndex = releaseGroups.reduce((bestIndex, group, index) => {
          const candidate = group[0]?.created_at || ''
          const current = releaseGroups[bestIndex]?.[0]?.created_at || ''
          return candidate > current ? index : bestIndex
        }, 0)
        activeProjectId = projectRows[mostRecentIndex]?.project_id || projectRows[0]?.project_id || ''
        releaseRows = releaseGroups[mostRecentIndex] || []
      }
      setProjectId(activeProjectId)
      if (!activeProjectId) {
        setReleases([])
        setSelectedRelease(null)
        setTelemetry([])
        return
      }
      const [loadedReleases, telemetryRows] = await Promise.all([
        releaseRows ? Promise.resolve(releaseRows) : getProjectReleases(activeProjectId),
        getLlmTelemetry(500),
      ])
      setReleases(loadedReleases)
      setTelemetry(telemetryRows)
      const latest = loadedReleases[0]
      setSelectedRelease(latest ? await getReleaseReport(latest.release_id) : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the Canary database')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const project = projects.find((item) => item.project_id === projectId)
  const latest = releases[0]
  const telemetryTotals = useMemo(() => telemetry.reduce((total, call) => ({
    calls: total.calls + 1,
    tokens: total.tokens + (call.total_tokens || 0),
    latency: total.latency + (call.latency_seconds || 0),
  }), { calls: 0, tokens: 0, latency: 0 }), [telemetry])

  const selectRelease = async (release: ReleaseRecord) => {
    setSelectedRelease(null)
    try { setSelectedRelease(await getReleaseReport(release.release_id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load release evidence') }
  }

  const submitRelease = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!projectId || !commitSha.trim()) return
    setSubmittingRelease(true)
    setError(null)
    try {
      await createProjectRelease(projectId, { commit_sha: commitSha.trim(), environment: project?.environment || 'preview' })
      setCommitSha('')
      setShowReleaseForm(false)
      await load(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the release gate')
    } finally {
      setSubmittingRelease(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#03090b] font-mono text-white">
      <Navbar onRunAudit={onRunAudit} onFindings={onFindings} onRedTeam={onRedTeam} onLogoClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-28 sm:px-10 lg:px-16">
        <header className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-red-300/70">Agent Canary / Release Security</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Ship the agent.<br /><span className="text-white/40">Know the delta.</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/55">Live project, release, differential, and LLM telemetry from the Canary backend database. No sample counts, no static findings.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => void load(projectId)} className="border border-white/15 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/60 hover:border-white/40">Refresh database</button>
            <button onClick={() => setShowReleaseForm((value) => !value)} className="bg-red-500 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white hover:bg-red-400">New release ↗</button>
          </div>
        </header>

        {error && <div className="mt-6 border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">{error}</div>}
        {loading && <div className="py-16 text-xs uppercase tracking-[0.2em] text-white/40">Reading persisted release data…</div>}
        {!loading && !projects.length && <div className="py-16 text-sm text-white/45">No projects are persisted yet. Create a project or start a release gate.</div>}

        {!loading && projects.length > 0 && (
          <>
            {showReleaseForm && <form onSubmit={submitRelease} className="mt-6 border border-red-400/30 bg-red-500/[0.06] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end"><label className="flex-1"><span className="text-[9px] uppercase tracking-[0.2em] text-white/45">Candidate commit SHA</span><input required minLength={4} maxLength={128} pattern="[A-Za-z0-9._/-]+" value={commitSha} onChange={(event) => setCommitSha(event.target.value)} placeholder="abcd1234 or pull/42" className="mt-2 w-full border border-white/15 bg-black px-3 py-3 text-xs text-white outline-none focus:border-red-300" /></label><button disabled={submittingRelease} className="border border-red-300/60 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-red-200 disabled:opacity-40">{submittingRelease ? 'Starting…' : 'Start security gate'}</button></div><p className="mt-3 text-[10px] text-white/35">The AWS backend will attack this candidate, replay the accepted baseline, persist evidence, and update this release history.</p></form>}
            <section className="mt-8 flex flex-col gap-4 border border-white/10 bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[9px] uppercase tracking-[0.2em] text-white/35">Project from backend</p><p className="mt-2 text-xl text-white">{project?.name}</p><p className="mt-1 text-xs text-white/35">{project?.repository || project?.endpoint} · {project?.environment}</p></div>
              <select value={projectId} onChange={(event) => { setProjectId(event.target.value); void load(event.target.value) }} className="border border-white/15 bg-black px-3 py-3 text-xs text-white/75 outline-none"><option value="" disabled>Select project</option>{projects.map((item) => <option key={item.project_id} value={item.project_id}>{item.name}</option>)}</select>
            </section>

            <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label="Releases" value={releases.length} />
              <Metric label="Latest decision" value={(latest?.decision || latest?.status || '—').toUpperCase()} />
              <Metric label="Candidate score" value={latest?.candidate_score ?? '—'} />
              <Metric label="Coverage" value={latest?.coverage?.percentage != null ? `${latest.coverage.percentage}%` : '—'} />
              <Metric label="LLM tokens loaded" value={telemetryTotals.tokens.toLocaleString()} />
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><h2 className="text-xs uppercase tracking-[0.2em] text-white/70">Release history</h2><span className="text-[10px] text-white/30">{releases.length} persisted</span></div>
                <div className="divide-y divide-white/[0.07]">
                  {releases.map((release) => <button key={release.release_id} onClick={() => void selectRelease(release)} className="grid w-full grid-cols-[1fr_auto] gap-4 px-5 py-4 text-left hover:bg-white/[0.04] sm:grid-cols-[1fr_auto_auto_auto]">
                    <div><p className="text-xs text-white/80">{shortId(release.commit_sha)} <span className="ml-2 text-white/30">{release.environment}</span></p><p className="mt-1 text-[10px] text-white/35">{shortId(release.release_id)} · {formatTime(release.created_at)}</p></div>
                    <span className={`h-fit border px-2 py-1 text-[9px] uppercase tracking-wider ${decisionClass[release.decision || ''] || 'border-white/15 text-white/45'}`}>{release.decision || release.status}</span>
                    <span className="hidden text-xs text-white/55 sm:block">{release.candidate_score ?? '—'} score</span>
                    <span className="hidden text-xs text-white/40 sm:block">Δ {release.score_delta ?? '—'}</span>
                  </button>)}
                </div>
              </div>

              <div className="border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-xs uppercase tracking-[0.2em] text-white/70">Latest evidence</h2>
                {selectedRelease ? <div className="mt-5 space-y-4"><div className="flex items-center justify-between"><span className={`border px-3 py-2 text-xs uppercase ${decisionClass[selectedRelease.release.decision || ''] || 'border-white/15 text-white/50'}`}>{selectedRelease.release.decision || selectedRelease.release.status}</span><span className="text-[10px] text-white/35">{shortId(selectedRelease.release.release_id)}</span></div><div className="grid grid-cols-3 gap-2"><Metric label="Baseline" value={selectedRelease.release.baseline_score ?? '—'} /><Metric label="Candidate" value={selectedRelease.release.candidate_score ?? '—'} /><Metric label="Delta" value={selectedRelease.release.score_delta ?? '—'} /></div><div className="space-y-2 text-xs text-white/55"><p>Cases: {selectedRelease.regressions.length}</p><p>New regressions: {selectedRelease.regressions.filter((item) => item.classification === 'regression').length}</p><p>Resolved: {selectedRelease.regressions.filter((item) => item.classification === 'resolved').length}</p><p>Findings with evidence: {selectedRelease.findings.length}</p></div><div className="space-y-2">{selectedRelease.regressions.map((item) => <details key={item.regression_id} className="border border-white/10 bg-black/20 p-3"><summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-white/70">{item.classification} · {item.severity || 'unrated'} · {item.attack_case_id.slice(0, 8)}…</summary><div className="mt-3 grid gap-3 text-[10px] leading-5 text-white/55"><div><p className="uppercase tracking-[0.16em] text-white/30">Attack</p><p className="mt-1 whitespace-pre-wrap">{String(item.baseline_evidence?.prompt || item.candidate_evidence?.prompt || 'No prompt persisted')}</p></div><div className="grid gap-3 sm:grid-cols-2"><div><p className="uppercase tracking-[0.16em] text-white/30">Baseline response</p><p className="mt-1 whitespace-pre-wrap">{String(item.baseline_evidence?.response || '—')}</p></div><div><p className="uppercase tracking-[0.16em] text-white/30">Candidate response</p><p className="mt-1 whitespace-pre-wrap">{String(item.candidate_evidence?.response || '—')}</p></div></div><p>Evaluator: {item.reason || 'No rationale persisted'}</p></div></details>)}</div></div> : <p className="mt-5 text-xs text-white/35">Select a release to load its persisted evidence.</p>}
              </div>
            </section>

            <section className="mt-6 border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center justify-between"><h2 className="text-xs uppercase tracking-[0.2em] text-white/70">LLM telemetry loaded from database</h2><span className="text-[10px] text-white/35">{telemetryTotals.calls} calls · {telemetryTotals.latency.toFixed(1)}s latency</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Calls" value={telemetryTotals.calls} /><Metric label="Total tokens" value={telemetryTotals.tokens.toLocaleString()} /><Metric label="Avg latency" value={telemetryTotals.calls ? `${(telemetryTotals.latency / telemetryTotals.calls).toFixed(2)}s` : '—'} /><Metric label="Latest agent" value={telemetry[0]?.agent || '—'} /></div><div className="mt-4 space-y-2">{telemetry.slice(0, 8).map((call) => <details key={call.id} className="border border-white/10 px-3 py-2"><summary className="flex cursor-pointer list-none flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/55"><span>{call.agent}</span><span>{call.total_tokens.toLocaleString()} tokens</span><span>{call.latency_seconds.toFixed(2)}s</span><span>{call.status_code || '—'}</span></summary><div className="mt-3 grid gap-3 text-[10px] leading-5 text-white/50 sm:grid-cols-2"><div><p className="uppercase tracking-[0.16em] text-white/30">Prompt</p><p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap">{call.prompt || '—'}</p></div><div><p className="uppercase tracking-[0.16em] text-white/30">Response</p><p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap">{call.response || call.error || '—'}</p></div></div></details>)}</div></section>
          </>
        )}
      </div>
    </main>
  )
}
