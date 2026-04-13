import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Settings() {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    notify_email: profile.notify_email ?? true,
    notify_slack: profile.notify_slack ?? false,
    slack_webhook_url: profile.slack_webhook_url || '',
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      await api('/me/preferences', { method: 'PATCH', body: form });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Notification settings</h2>
      <form className="card" onSubmit={submit} style={{ maxWidth: 520 }}>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.notify_email}
              onChange={(e) => setForm({ ...form, notify_email: e.target.checked })}
            />{' '}
            Email me ({profile.email || 'no email on file'})
          </label>
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.notify_slack}
              onChange={(e) => setForm({ ...form, notify_slack: e.target.checked })}
            />{' '}
            Send to my personal Slack webhook
          </label>
        </div>

        <div className="field">
          <label>Slack incoming webhook URL</label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={form.slack_webhook_url}
            onChange={(e) => setForm({ ...form, slack_webhook_url: e.target.value })}
          />
        </div>

        <button disabled={busy}>{busy ? '…' : 'Save'}</button>
        {saved && <span className="muted" style={{ marginLeft: 12 }}>Saved.</span>}
      </form>
    </div>
  );
}
