import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

// Shown after a brand-new Supabase signup, before a profile row exists.
// In production this should be locked down — for now it lets the first user
// pick admin so they can then create the rest of the team.
export default function Bootstrap() {
  const { signOut, bootstrapProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('admin');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await bootstrapProfile({ full_name: fullName, role });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Set up your profile</h2>
        <div className="field">
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="account_manager">Account manager</option>
            <option value="designer">Designer</option>
          </select>
        </div>
        {err && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{err}</div>}
        <button disabled={busy} style={{ width: '100%' }}>{busy ? '…' : 'Continue'}</button>
        <button type="button" className="secondary" style={{ width: '100%', marginTop: 8 }} onClick={signOut}>
          Sign out
        </button>
      </form>
    </div>
  );
}
