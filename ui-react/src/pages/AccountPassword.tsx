import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'

// Self-service password change for local accounts. The account service applies the change; this form sends it the same
// four fields its own page did and shows the message it answers with.
export default function AccountPassword() {
  const [f, setF] = useState({ username: '', old_pwd: '', new_pwd: '', new_pwd_verify: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.username || !f.old_pwd || !f.new_pwd) return setMsg({ ok: false, text: 'Fill in the user name, old password and new password.' })
    if (f.new_pwd !== f.new_pwd_verify) return setMsg({ ok: false, text: 'The new password and its confirmation do not match.' })
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/auth/selfservice.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(f).toString(),
        credentials: 'same-origin',
      })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const note = (doc.querySelector('.result, .alert') as HTMLElement | null)?.textContent?.trim()
      const failed = !res.ok || /alert-(danger|warning)|error|invalid|incorrect|not match|fail/i.test(`${doc.querySelector('.result, .alert')?.className ?? ''} ${note ?? ''}`)
      setMsg({ ok: !failed, text: note || (res.ok ? 'Request sent. If the old password was right, the password is now changed.' : `The account service answered ${res.status}.`) })
      if (!failed) setF({ username: f.username, old_pwd: '', new_pwd: '', new_pwd_verify: '' })
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message ?? 'The account service could not be reached.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHero icon="🔑" title="Change your password" sub="Change the password of your own local account." to="/accounts" linkLabel="← Accounts" />
      <form className="card" onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>
            User name
            <input type="text" value={f.username} autoComplete="username" onChange={(e) => set('username', e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Old password
            <input type="password" value={f.old_pwd} autoComplete="current-password" onChange={(e) => set('old_pwd', e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            New password
            <input type="password" value={f.new_pwd} autoComplete="new-password" onChange={(e) => set('new_pwd', e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Confirm new password
            <input type="password" value={f.new_pwd_verify} autoComplete="new-password" onChange={(e) => set('new_pwd_verify', e.target.value)} style={{ width: '100%' }} />
          </label>
        </div>
        {msg && <p className={msg.ok ? 'muted' : 'err'}>{msg.text}</p>}
        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Changing…' : 'Change'}
          </button>
          <Link to="/accounts/login" className="muted">
            Administrator login
          </Link>
        </div>
      </form>
    </>
  )
}
