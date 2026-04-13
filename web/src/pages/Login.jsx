import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);
    if (error) setErr(error.message);
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="card auth-card" onSubmit={submit}>
        <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="field">
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        {err && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{err}</div>}
        <button disabled={busy} style={{ width: '100%' }}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <div className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          {mode === 'signin' ? (
            <a onClick={() => setMode('signup')}>Need an account?</a>
          ) : (
            <a onClick={() => setMode('signin')}>Already have an account?</a>
          )}
        </div>
      </form>
    </div>
  );
}
