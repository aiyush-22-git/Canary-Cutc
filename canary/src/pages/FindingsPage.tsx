import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { getProjectReleases, getProjects, getReleaseReport } from '../lib/api'
import type { ProjectRecord, ReleaseRecord, ReleaseRegression } from '../lib/api'

interface FindingsPageProps { onBack: () => void; onRedTeam?: () => void }
type FindingRow = ReleaseRegression & { release: ReleaseRecord; project: ProjectRecord }
const classes: Record<string, string> = { regression: 'text-red-200 border-red-400/40 bg-red-500/10', known: 'text-amber-200 border-amber-400/40 bg-amber-400/10', resolved: 'text-emerald-200 border-emerald-400/40 bg-emerald-400/10', clean: 'text-white/50 border-white/15 bg-white/[0.03]' }
const compact = (value?: string | null) => value ? `${value.slice(0, 8)}…` : '—'

export default function FindingsPage({ onBack, onRedTeam }: FindingsPageProps) {
  const [rows, setRows] = useState<FindingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classification, setClassification] = useState('all')
  const [projectId, setProjectId] = useState('all')

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const projects = await getProjects()
      const batches = await Promise.all(projects.map(async (project) => {
        const releases = await getProjectReleases(project.project_id)
        const reports = await Promise.all(releases.map((release) => getReleaseReport(release.release_id)))
        return reports.flatMap((report, index) => report.regressions.map((regression) => ({ ...regression, release: releases[index], project })))
      }))
      setRows(batches.flat().sort((a, b) => (b.release.created_at || '').localeCompare(a.release.created_at || '')))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load persisted findings') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])
  const projects = useMemo(() => Array.from(new Map(rows.map((row) => [row.project.project_id, row.project])).values()), [rows])
  const filtered = useMemo(() => rows.filter((row) => (classification === 'all' || row.classification === classification) && (projectId === 'all' || row.project.project_id === projectId)), [rows, classification, projectId])
  const counts = useMemo(() => ({ regression: rows.filter((row) => row.classification === 'regression').length, known: rows.filter((row) => row.classification === 'known').length, resolved: rows.filter((row) => row.classification === 'resolved').length }), [rows])

  return <main className="min-h-screen bg-black px-6 pb-20 pt-32 font-mono text-white sm:px-10 md:px-16 lg:px-20"><Navbar onLogoClick={onBack} onRedTeam={onRedTeam} /><header className="border-b border-white/10 pb-8"><p className="text-[10px] uppercase tracking-[0.3em] text-red-300/70">Agent Canary / Findings</p><h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Security behaviour,<br /><span className="text-white/40">persisted as evidence.</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">This is the database-backed cross-release view. A finding is a baseline-versus-candidate result, not a synthetic severity count.</p></header>{error && <p className="mt-6 border border-red-400/30 bg-red-500/10 p-4 text-xs text-red-200">{error}</p>}{loading ? <p className="py-14 text-xs uppercase tracking-[0.2em] text-white/35">Reading persisted findings…</p> : <><section className="mt-7 grid gap-3 sm:grid-cols-3">{[['New regressions', counts.regression, 'regression'], ['Known behaviour', counts.known, 'known'], ['Resolved', counts.resolved, 'resolved']].map(([label, value, key]) => <div key={String(key)} className="border border-white/10 bg-white/[0.02] p-4"><p className="text-[9px] uppercase tracking-[0.17em] text-white/35">{label}</p><p className={`mt-2 text-2xl ${classes[String(key)].split(' ')[0]}`}>{value}</p></div>)}</section><section className="mt-6 flex flex-col gap-3 border border-white/10 bg-white/[0.02] p-4 sm:flex-row"><label className="flex-1 text-[9px] uppercase tracking-[0.16em] text-white/35">Classification<select value={classification} onChange={(event) => setClassification(event.target.value)} className="mt-2 w-full border border-white/15 bg-black p-3 text-xs normal-case tracking-normal text-white"><option value="all">All persisted outcomes</option><option value="regression">New regressions</option><option value="known">Known behaviour</option><option value="resolved">Resolved</option><option value="clean">Clean</option></select></label><label className="flex-1 text-[9px] uppercase tracking-[0.16em] text-white/35">Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-2 w-full border border-white/15 bg-black p-3 text-xs normal-case tracking-normal text-white"><option value="all">All projects</option>{projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.name}</option>)}</select></label><button onClick={() => void load()} className="self-end border border-red-400/50 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-red-200">Refresh database</button></section><section className="mt-6 space-y-3">{filtered.length === 0 ? <p className="py-10 text-sm text-white/35">No persisted findings match these filters.</p> : filtered.map((row) => <details key={row.regression_id} className="border border-white/10 bg-white/[0.02] p-4"><summary className="flex cursor-pointer flex-wrap items-center gap-3"><span className={`border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${classes[row.classification] || classes.clean}`}>{row.classification}</span><span className="text-xs uppercase tracking-[0.12em] text-white/60">{row.severity || 'unrated'}</span><span className="text-xs text-white/35">{row.project.name} · {compact(row.release.commit_sha)}</span></summary><div className="mt-4 grid gap-4 text-xs leading-6 text-white/60 md:grid-cols-2"><div><p className="text-[9px] uppercase tracking-[0.17em] text-white/30">Attack</p><p className="mt-1 whitespace-pre-wrap">{String(row.candidate_evidence?.prompt || row.baseline_evidence?.prompt || '—')}</p></div><div><p className="text-[9px] uppercase tracking-[0.17em] text-white/30">Why it was classified</p><p className="mt-1">{row.reason || '—'}</p><p className="mt-3 text-[9px] uppercase tracking-[0.17em] text-white/30">Baseline → candidate verdict</p><p className="mt-1">{row.baseline_verdict || '—'} → {row.candidate_verdict || '—'}</p></div></div></details>)}</section></>}</main>
}
