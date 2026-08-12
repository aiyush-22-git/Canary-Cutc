import { useState } from 'react'
import './index.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FindingsPage from './pages/FindingsPage'
import RedTeamPage from './pages/RedTeamPage'

type Page = 'home' | 'findings' | 'redteam'

export default function App() {
  const [page, setPage] = useState<Page>('home')

  const nav = (p: Page) => () => setPage(p)

  if (page === 'findings') return <FindingsPage onBack={nav('home')} onRedTeam={nav('redteam')} />
  if (page === 'redteam')  return <RedTeamPage  onBack={nav('home')} onFindings={nav('findings')} />

  return (
    <main className="bg-black min-h-screen font-mono">
      <Navbar
        onFindings={nav('findings')}
        onRedTeam={nav('redteam')}
      />
      <Hero />
    </main>
  )
}
