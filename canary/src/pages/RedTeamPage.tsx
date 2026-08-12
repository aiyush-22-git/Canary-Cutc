import { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { getProjectReleases, getProjects, getReleaseReport } from '../lib/api'
import type { ProjectRecord, ReleaseRecord, ReleaseReport } from '../lib/api'

interface RedTeamPageProps {
  onBack: () => void
  onFindings?: () => void
}

const colors: Record<string, string> = {
  pass: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  block: 'border-red-400/40 bg-red-500/10 text-red-200',
  regression: 'border-red-400/40 bg-red-500/10 text-red-200',
  known: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  resolved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  clean: 'border-white/15 bg-white/[0.03] text-white/55',
}

const short = (value?: string | null) => value ? `${value.slice(0, 8)}…` : '—'
const when = (value?: string | null) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function RedTeamPage({ onBack, onFindings }: RedTeamPageProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [releases, setReleases] = useState<ReleaseRecord[]>([])
  const [report, setReport] = useState<ReleaseReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (requestedProject?: string, requestedRelease?: string) => {
    setLoading(true)
    setError(null)
    try {
      const projectRows = await getProjects()
      let chosenProjectId = requestedProject || projectId
      let releaseRows: ReleaseRecord[] | undefined
      if (!chosenProjectId && projectRows.length) {
        const groups = await Promise.all(projectRows.map((item) => getProjectReleases(item.project_id)))
        const newestIndex = groups.reduce((best, rows, index) => (rows[0]?.created_at || '') > (groups[best][0]?.created_at || '') ? index : best, 0)
        chosenProjectId = projectRows[newestIndex]?.project_id || projectRows[0].project_id
        releaseRows = groups[newestIndex]
      }
      const selectedReleases = releaseRows || (chosenProjectId ? await getProjectReleases(chosenProjectId) : [])
      const chosenReleaseId = requestedRelease || selectedReleases[0]?.release_id
      setProjects(projectRows)
      setProjectId(chosenProjectId)
      setReleases(selectedReleases)
      setReport(chosenReleaseId ? await getReleaseReport(chosenReleaseId) : null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load persisted red-team evidence')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])
  const project = useMemo(() => projects.find((item) => item.project_id === projectId), [projects, projectId])
  const release = report?.release

  return <main className="min-h-screen bg-black px-6 pb-20 pt-32 font-mono text-white sm:px-10 md:px-16 lg:px-20">
    <Navbar onLogoClick={onBack} onFindings={onFindings} />
    <header className="border-b border-white/10 pb-8"><p className="text-[10px] uppercase tracking-[0.3em] text-red-300/70">Agent Canary / Red Team</p><h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Attack evidence.<br /><span className="text-white/40">Compared, not guessed.</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">Every item below is persisted by the AWS release gate: the attack, baseline behaviour, candidate behaviour, evaluator conclusion, and classification.</p></header>
    {error && <p className="mt-6 border border-red-400/30 bg-red-500/10 p-4 text-xs text-red-200">{error}</p>}
    {loading && <p className="py-14 text-xs uppercase tracking-[0.2em] text-white/35">Loading persisted red-team evidence…</p>}
    {!loading && <><section className="mt-7 grid gap-3 border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-2"><label className="text-[9px] uppercase tracking-[0.16em] text-white/35">Project<select value={projectId} onChange={(event) => void load(event.target.value)} className="mt-2 w-full border border-white/15 bg-black p-3 text-xs normal-case tracking-normal text-white"><option value="">Select project</option>{projects.map((item) => <option key={item.project_id} value={item.project_id}>{item.name}</option>)}</select></label><label className="text-[9px] uppercase tracking-[0.16em] text-white/35">Security check<select value={release?.release_id || ''} onChange={(event) => void load(projectId, event.target.value)} className="mt-2 w-full border border-white/15 bg-black p-3 text-xs normal-case tracking-normal text-white"><option value="">Select release</option>{releases.map((item) => <option key={item.release_id} value={item.release_id}>{short(item.commit_sha)} · {item.decision || item.status} · {when(item.created_at)}</option>)}</select></label></section>
    {project && release && <><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['Project', project.name], ['Decision', (release.decision || release.status).toUpperCase()], ['Baseline → candidate', `${release.baseline_score ?? '—'} → ${release.candidate_score ?? '—'}`], ['Delta', release.score_delta ?? '—'], ['Coverage', release.coverage?.percentage == null ? '—' : `${release.coverage.percentage}%`]].map(([label, value]) => <div key={label} className="border border-white/10 bg-white/[0.02] p-4"><p className="text-[9px] uppercase tracking-[0.17em] text-white/35">{label}</p><p className="mt-2 text-sm text-white/80">{value}</p></div>)}</section>
    <section className="mt-8"><div className="flex items-end justify-between border-b border-white/10 pb-3"><h2 className="text-xs uppercase tracking-[0.2em] text-white/70">Differential attack cases</h2><button onClick={() => void load(projectId, release.release_id)} className="text-[10px] uppercase tracking-[0.16em] text-red-300/75 hover:text-red-200">Refresh</button></div><div className="mt-4 space-y-3">{report.regressions.length === 0 ? <p className="text-sm text-white/40">No completed attack cases are persisted for this check.</p> : report.regressions.map((item) => <details key={item.regression_id} className="border border-white/10 bg-white/[0.02] p-4"><summary className="flex cursor-pointer flex-wrap items-center gap-3 text-xs"><span className={`border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${colors[item.classification] || colors.clean}`}>{item.classification}</span><span className="uppercase tracking-[0.13em] text-white/55">{item.severity || 'unrated'}</span><span className="text-white/35">case {short(item.attack_case_id)}</span></summary><div className="mt-4 grid gap-4 text-xs leading-6 text-white/60"><div><p className="text-[9px] uppercase tracking-[0.17em] text-white/30">Attack prompt</p><p className="mt-1 whitespace-pre-wrap">{String(item.candidate_evidence?.prompt || item.baseline_evidence?.prompt || '—')}</p></div><div className="grid gap-4 md:grid-cols-2"><div><p className="text-[9px] uppercase tracking-[0.17em] text-white/30">Accepted baseline</p><p className="mt-1 whitespace-pre-wrap">{String(item.baseline_evidence?.response || '—')}</p></div><div><p className="text-[9px] uppercase tracking-[0.17em] text-white/30">Candidate</p><p className="mt-1 whitespace-pre-wrap">{String(item.candidate_evidence?.response || '—')}</p></div></div><p><span className="text-[9px] uppercase tracking-[0.17em] text-white/30">Evaluator</span><br />{item.reason || '—'}</p></div></details>)}</div></section></>}
    </>}
  </main>
}
