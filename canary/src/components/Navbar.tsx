import { useState, useEffect } from 'react'

const Logo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 256 256" fill="none" aria-label="Canary" role="img">
    <path
      d="M 256 64 L 256 128 L 192.5 128 L 160 95 L 128 64 L 96 95 L 63.5 128 L 64 128 L 128 192 L 128 256 L 64.5 256 L 32 223 L 0 192 L 0 64 L 64 0 L 192 0 Z M 256 192 L 256 256 L 192.5 256 L 160 223 L 128 192 L 128 128 L 192 128 Z"
      fill="#fb7185"
    />
  </svg>
)

const NAV_LINKS = [
  { label: 'Red Team',  key: 'redteam'  },
  { label: 'Findings',  key: 'findings' },
]

interface NavbarProps {
  onLogoClick?: () => void
  onRedTeam?: () => void
  onFindings?: () => void
}

export default function Navbar({ onLogoClick, onRedTeam, onFindings }: NavbarProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    redteam: onRedTeam, findings: onFindings,
  }
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 md:h-20 px-6 sm:px-10 md:px-16 lg:px-20 flex items-center justify-between transition-all duration-300 ${
          scrolled ? 'bg-black/70 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        {/* Logo */}
        <a href={onLogoClick ? undefined : '/'} onClick={onLogoClick} className="flex-shrink-0 cursor-pointer flex items-center gap-5">
          <Logo />
          <span className="hidden sm:flex flex-col gap-0.5 text-white/60 text-[9px] uppercase tracking-[0.22em] font-light leading-tight">
            <span className="animate-brand-word" style={{ animationDelay: '120ms' }}>Adversarial</span>
            <span className="animate-brand-word" style={{ animationDelay: '240ms' }}>Agent</span>
            <span className="animate-brand-word" style={{ animationDelay: '360ms' }}>Evaluation</span>
          </span>
        </a>

        {/* Menu trigger */}
        <button
          className="flex flex-col justify-center items-center w-10 h-10 gap-2 relative z-50 group"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span
            className="w-7 h-px bg-white/80 block transition-all duration-300 ease-out origin-center group-hover:bg-red-400"
            style={menuOpen ? { transform: 'translateY(5px) rotate(45deg)' } : {}}
          />
          <span
            className="w-7 h-px bg-white/80 block transition-all duration-300 ease-out group-hover:bg-red-400"
            style={menuOpen ? { opacity: 0, transform: 'scaleX(0)' } : {}}
          />
          <span
            className="w-7 h-px bg-white/80 block transition-all duration-300 ease-out origin-center group-hover:bg-red-400"
            style={menuOpen ? { transform: 'translateY(-5px) rotate(-45deg)' } : {}}
          />
        </button>
      </nav>

      {/* Full-screen editorial security menu */}
      <div className={`fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#03090b] transition-opacity duration-500 ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(circle_at_82%_20%,rgba(127,29,29,0.28),transparent_32%),linear-gradient(120deg,#03090b_0%,#06151a_55%,#020506_100%)]" />
        <div className="absolute right-[8%] top-[22%] text-red-500/[0.12] text-8xl sm:text-[12rem] font-bold rotate-12 pointer-events-none">01</div>
        <div className="absolute left-[8%] bottom-[14%] w-40 h-40 sm:w-64 sm:h-64 border border-red-500/[0.14] rounded-full rotate-[-18deg] pointer-events-none" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-red-500/[0.12] pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-center flex-1 px-6 sm:px-12 md:px-20 lg:px-28 pt-20 pb-10">
          <div className="mb-8 flex items-center justify-between text-[9px] uppercase tracking-[0.28em] text-white/35 font-mono">
            <span>Canary // Secure Navigation</span>
            <span className="text-red-400/70">0x7F-A91C</span>
          </div>

          {[...NAV_LINKS, { label: 'Request Access', key: 'access' }, { label: 'About', key: 'about' }].map(({ label, key }, i) => (
            <button
              key={key}
              onClick={() => { setMenuOpen(false); handlers[key]?.() }}
              className="group flex w-full items-baseline justify-between border-b border-white/[0.14] py-4 sm:py-5 text-left transition-all duration-300 hover:border-red-500/75 hover:shadow-[0_8px_24px_-18px_rgba(239,68,68,0.9)]"
              style={{ transitionProperty: 'opacity, transform', transitionDuration: '0.45s', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)', transitionDelay: menuOpen ? `${i * 55 + 120}ms` : '0ms', opacity: menuOpen ? 1 : 0, transform: menuOpen ? 'translateY(0)' : 'translateY(24px)' }}
            >
              <span className="mr-5 text-[clamp(1.8rem,5.5vw,5rem)] font-bold uppercase leading-[0.9] tracking-[-0.06em] text-white/85 group-hover:text-red-300 group-hover:[text-shadow:0_0_10px_rgba(239,68,68,0.9),0_0_24px_rgba(127,29,29,0.75)] transition-all duration-300">
                <span className="mr-3 text-[10px] sm:text-xs font-mono font-light tracking-[0.18em] text-red-500/70 align-middle">0{i + 1}</span>
                {label}
              </span>
              <span className="text-red-500/0 text-xl transition-all duration-300 group-hover:text-red-300 group-hover:[text-shadow:0_0_10px_rgba(239,68,68,0.85),0_0_18px_rgba(127,29,29,0.7)] group-hover:translate-x-1">↗</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
