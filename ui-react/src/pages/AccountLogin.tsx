import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'

// Administrator sign-in for local accounts. The existing account service still checks the password and opens the session:
// this form sends it the same two fields its own page did, and on success opens the account administration page.
export default function AccountLogin() {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !password) {
      setError('Enter the user name and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/auth/admin_login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ user, password }).toString(),
        credentials: 'same-origin',
      })
      if (/htadmin\.php/i.test(res.url)) {
        window.location.assign('/auth/htadmin.php')
        return
      }
      setError(res.ok ? 'Sign-in failed. Check the user name and password.' : `The account service answered ${res.status}.`)
    } catch (err: any) {
      setError(err?.message ?? 'The account service could not be reached.')
    } finally {
      setBusy(false)
      setPassword('')
    }
  }

  return (
    <>
      <PageHero icon="🔐" title="Administrator login" sub="Sign in to add, remove and edit local accounts and their permissions." to="/accounts" linkLabel="← Accounts" />
      <form className="card" onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>
            User name
            <input type="text" value={user} autoComplete="username" autoFocus onChange={(e) => setUser(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Password
            <input type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }} />
          </label>
        </div>
        {error && <p className="err">{error}</p>}
        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Login'}
          </button>
          <Link to="/accounts/password" className="muted">
            Change my own password
          </Link>
        </div>
      </form>
    </>
  )
}
