const TICKER_TEXT =
  '[ THREAT DETECTED: ASI-03 Prompt Injection ] · [ CAMPAIGN RX-041823 ACTIVE ] · [ AGENT: LLM-TOOL-BRIDGE COMPROMISED ] · [ FINDING: SEVERITY CRITICAL ] · [ REPLAY VERIFICATION IN PROGRESS ] · '

interface HeroProps {
  onRunAudit?: () => void
}

function CyberWord({ word, startDelay }: { word: string; startDelay: number }) {
  return (
    <span className="block whitespace-nowrap" aria-label={word}>
      {Array.from(word).map((letter, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="hero-letter"
          style={{ animationDelay: `${startDelay + index * 34}ms` }}
        >
          {letter}
        </span>
      ))}
    </span>
  )
}

export default function Hero({ onRunAudit }: HeroProps) {
  const stats = [
    { value: 'LIVE', label: 'Status', cls: 'animate-hero-stat-1', red: true },
    { value: 'ASI10', label: 'Coverage', cls: 'animate-hero-stat-2', red: true },
    { value: 'ATLAS', label: 'Framework', cls: 'animate-hero-stat-3', red: false },
    { value: 'x500°', label: 'Attack Depth', cls: 'animate-hero-stat-3', red: false },
  ]

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {/* Layer 1: Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover animate-hero-video"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      {/* Layer 2a: Full-frame darkening overlay */}
      <div className="absolute inset-0 bg-black/55 pointer-events-none z-[5]" />

      {/* Layer 2b: Bottom fade to solid black */}
      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none z-[5]" />

      {/* Layer 2c: restrained AI-security interface ornament */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[6]" aria-hidden="true">
        <div className="absolute left-[8%] top-[24%] text-red-500/[0.14] text-7xl sm:text-9xl font-bold tracking-[-0.12em] rotate-[-12deg]">01</div>
        <div className="absolute right-[10%] top-[17%] text-red-400/[0.12] text-6xl sm:text-8xl font-bold tracking-[-0.15em] rotate-[9deg]">101</div>
        <div className="absolute right-[24%] bottom-[28%] w-32 h-32 sm:w-52 sm:h-52 border border-red-500/[0.18] rotate-45" />
        <div className="absolute left-[42%] top-[20%] w-20 h-20 sm:w-28 sm:h-28 border border-white/[0.08] rotate-[18deg]" />
        <div className="absolute left-0 right-0 top-[48%] h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
        <div className="absolute right-[7%] bottom-[17%] text-red-300/[0.18] text-[9px] uppercase tracking-[0.45em] rotate-90">AI / SECURITY / 07</div>
        <div className="absolute left-[12%] bottom-[22%] w-24 h-24 rounded-full border border-red-500/[0.12]" />
      </div>

      {/* Layer 3: Content */}
      <div className="relative z-10 h-full flex flex-col justify-end px-6 sm:px-10 md:px-16 lg:px-20 pb-12 md:pb-16 lg:pb-20">

        {/* Label */}
        <p className="animate-hero-label text-white/50 text-[10px] sm:text-xs tracking-[0.3em] uppercase font-light mb-6 md:mb-8">
          Autonomous Red-Team Engine. By Agent Canary.
        </p>

        {/* Threat ticker */}
        <div className="overflow-hidden mb-6 md:mb-8">
          <div className="animate-ticker whitespace-nowrap text-red-600/70 text-[10px] tracking-[0.15em] uppercase font-light">
            {(TICKER_TEXT).repeat(3)}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10 md:gap-16 lg:gap-20">

          {/* Left column */}
          <div className="flex-shrink-0">
            <h1
              className="text-white font-bold uppercase leading-[0.9] tracking-[-0.06em]"
              style={{ fontSize: 'clamp(2.25rem, 6vw, 5rem)' }}
            >
              <CyberWord word="Adversarial" startDelay={120} />
              <CyberWord word="Agent" startDelay={520} />
              <CyberWord word="Evaluation" startDelay={760} />
            </h1>

            {/* Meta line */}
            <div className="animate-hero-meta mt-6 flex items-center gap-6 text-white/40 text-[10px] sm:text-xs tracking-wider uppercase font-light">
              <span>Campaign: RX-041823</span>
              <span className="animate-hero-divider w-8 h-[1px] bg-red-600/40 inline-block" />
              <span>Mode: Sigma</span>
            </div>

            <div className="mt-4 max-w-xl border-t border-white/[0.08] pt-3 text-[8px] uppercase tracking-[0.16em] text-white/25 font-mono">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-1.5 text-white/35">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  System_Status: <span className="text-emerald-300/70">Nominal</span>
                </span>
                <span className="h-px w-5 bg-white/10" />
                <span>Threat_Level: <span className="text-red-400/70">Elevated</span></span>
                <span className="h-px w-5 bg-white/10" />
                <span>Scan_ID: <span className="text-white/40">0x7F-A91C</span></span>
                <span className="h-px w-5 bg-white/10" />
                <span>TS: <span className="text-white/40">2026-08-11 14:32:08Z</span></span>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="relative flex flex-col gap-6 border-l border-red-500/25 pl-5 sm:pl-6 lg:max-w-md">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-[8px] uppercase tracking-[0.2em] text-white/30 font-mono">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-red" />
                Audit Console
              </span>
              <span className="text-red-400/70">Live // 01</span>
            </div>

            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.16em] text-white/25 font-mono">
              <span>Target: Agent Surface</span>
              <span className="text-white/35">Stream: SSE</span>
            </div>

            <p className="animate-hero-description text-white/60 text-xs sm:text-sm leading-relaxed font-light">
              Autonomously discovering, evaluating, and remediating vulnerabilities across AI agent surfaces. Multi-agent orchestration exposes the most critical attack paths in enterprise agentic infrastructure.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border border-white/10 bg-black/20 divide-x divide-y divide-white/10 sm:divide-y-0 w-full max-w-xl">
              {stats.map(({ value, label, cls, red }) => (
                <div key={label} className={`${cls} flex min-h-[76px] flex-col justify-between gap-2 px-3 py-3 sm:px-4`}>
                  <span className="text-white/30 text-[8px] uppercase tracking-[0.2em] font-light">
                    {label}
                  </span>
                  <span className={`${red ? 'text-red-500' : 'text-white'} text-xl sm:text-2xl font-bold tracking-tight`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA row */}
            <div className="animate-hero-cta flex gap-4">
              <button
                onClick={onRunAudit}
                className="group flex items-center gap-2 border border-red-500/70 bg-red-600/90 px-6 py-3 text-white text-xs uppercase tracking-[0.15em] font-medium hover:bg-red-500 hover:shadow-[0_0_24px_rgba(239,68,68,0.4)] transition-all duration-300"
              >
                <span className="text-red-100 transition-transform duration-300 group-hover:translate-x-1">&gt;_</span>
                Run Audit
              </button>
              <button className="group flex items-center gap-2 border border-white/20 px-6 py-3 text-white text-xs uppercase tracking-[0.15em] font-light hover:border-red-500/70 hover:bg-red-950/20 transition-all duration-300">
                <span className="text-red-400/70 transition-transform duration-300 group-hover:translate-x-1">&gt;_</span>
                Request Access
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
