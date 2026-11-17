import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Common page header: icon, title, one-line description, an optional link to the related original tool and a slot for actions.
export default function PageHero({ icon, title, sub, href, linkLabel, to, children }: { icon: string; title: ReactNode; sub?: ReactNode; href?: string; linkLabel?: string; to?: string; children?: ReactNode }) {
  return (
    <header className="page-hero">
      <span className="page-hero-icon" aria-hidden="true">{icon}</span>
      <div className="page-hero-text">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="page-hero-actions">
        {children}
        {href && <a href={href} className="pill-link">{linkLabel ?? 'Open original ↗'}</a>}
        {to && <Link to={to} className="pill-link">{linkLabel ?? 'Back'}</Link>}
      </div>
    </header>
  )
}
