import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { DashboardDef } from '../data/catalog'
import { loadSavedDashboard } from '../lib/savedDashboard'
import DashboardView from './DashboardView'

// A saved dashboard that is not in the pre-built catalog, drawn from its definition on the server.
export default function SavedDashboard() {
  const { id = '' } = useParams()
  const [def, setDef] = useState<DashboardDef | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setDef(null)
    setError(null)
    loadSavedDashboard(id)
      .then((d) => alive && setDef(d))
      .catch((e) => alive && setError(e.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [id])
  if (error)
    return (
      <section className="card error-page">
        <h2>Could not load this dashboard</h2>
        <p className="err">{error}</p>
        <p><Link to="/management">Back to Management</Link></p>
      </section>
    )
  if (!def) return <p className="muted">Loading…</p>
  return <DashboardView def={def} />
}
