import { useEffect, useState } from 'react'
import { startRelabel } from '../lib/relabel'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/dashboards', label: 'Dashboards' },
  { to: '/explorer', label: 'Explorer' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/spiview', label: 'SPI View' },
  { to: '/connections', label: 'Connections' },
  { to: '/hunts', label: 'Hunts' },
  { to: '/settings', label: 'Settings' },
  { to: '/statistics', label: 'Statistics' },
  { to: '/assets', label: 'Assets' },
  { to: '/files', label: 'Files' },
  { to: '/management', label: 'Management' },
  { to: '/console', label: 'Console' },
  { to: '/upload', label: 'Upload' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/kiosk', label: 'Kiosk' },
  { to: '/status', label: 'Status' },
]

// Light / dark theme: stored per browser, applied as data-theme on <html> (index.html sets it before first paint).
type Theme = 'dark' | 'light'
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'))
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('sampark-theme', next)
    } catch {
      /* storage may be unavailable; the choice then lasts for this tab only */
    }
    setTheme(next)
  }
  return [theme, toggle]
}

// Small readiness dot (from /mapi/ready) linking to the Status page.
function Readiness() {
  const [state, setState] = useState<'ok' | 'bad' | 'unknown'>('unknown')
  useEffect(() => {
    let alive = true
    const check = () =>
      fetch('/mapi/ready')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => alive && setState(d.opensearch && d.pcap_monitor && d.logstash_lumberjack && d.logstash_pipelines ? 'ok' : 'bad'))
        .catch(() => alive && setState('unknown'))
    check()
    const t = setInterval(check, 30000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  const label = state === 'ok' ? 'Ready' : state === 'bad' ? 'Not ready' : 'Status unknown'
  return (
    <Link to="/status" className={`ready-dot ${state}`} title={label}>
      ● <span>{label}</span>
    </Link>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const [theme, toggleTheme] = useTheme()
  useEffect(() => startRelabel(), [])
  const wide = /^\/dashboards\/.+/.test(pathname)
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}sampark-logo.png`} alt="Sampark SOC Tool" />
        </span>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle light / dark theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <Readiness />
      </header>
      <main className={wide ? 'content wide' : 'content'}>
        <Outlet />
      </main>
      <footer className="footer">Sampark SOC Tool</footer>
    </div>
  )
}
