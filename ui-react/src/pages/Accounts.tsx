import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppConfig, defaultConfig, loadConfig } from '../config'
import PageHero from '../components/PageHero'
import { labelOf } from '../data/components'

// Account management is provided by the existing htadmin PHP app (third-party,
// built into its own container). This page is the React front door to it; the
// page names below match the links in htadmin/src/includes/nav.php.
export default function Accounts() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  useEffect(() => {
    loadConfig().then(setConfig)
  }, [])

  // htadmin only exists when the backend uses local (basic) accounts, where the link is /auth/. With LDAP,
  // Keycloak or no authentication the link points somewhere else (documentation, Keycloak, ...), and
  // appending htadmin page names to it would give broken URLs, so show a single tile instead.
  const label = labelOf('Keycloak') ?? config.authTitle
  const isHtadmin = /^\/auth\/?$/.test(config.authUrl)
  const actions = isHtadmin
    ? [
        {
          title: 'Administrator Login',
          desc: 'Add, remove and edit local accounts and their permissions.',
          href: '/accounts/login',
        },
        {
          title: 'Account Self Service',
          desc: 'Change your own password.',
          href: '/accounts/password',
        },
      ]
    : [
        {
          title: label,
          desc: 'Accounts are not managed locally in this authentication mode. Open the page that explains or manages them.',
          href: config.authUrl,
        },
      ]

  return (
    <>
      <PageHero icon="👤" title={label} sub="Users, sign-in and permissions." />
      <div className="tile-grid">
        {actions.map((a, i) => (
          <div className="card tile" key={a.title} style={{ ['--c' as any]: i % 2 ? '#34d399' : '#38bdf8' }}>
            <Wrap href={a.href} className="tile-head">
              <h3>{a.title}</h3>
            </Wrap>
            <p>{a.desc}</p>
            <Wrap href={a.href} className="btn">
              Open
            </Wrap>
          </div>
        ))}
      </div>
    </>
  )
}

// pages of this app open through the router, anything else (another authentication mode) as a normal link
function Wrap({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return href.startsWith('/accounts') ? (
    <Link className={className} to={href}>
      {children}
    </Link>
  ) : (
    <a className={className} href={href}>
      {children}
    </a>
  )
}
