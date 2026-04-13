import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() { setClients(await api('/clients')); }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="row between">
        <h2>Clients</h2>
        <button onClick={() => { setCreating(true); setEditing({}); }}>+ New client</button>
      </div>

      <div className="grid grid-3">
        {clients.map((c) => (
          <div key={c.id} className="card">
            <strong>{c.name}</strong>
            <div className="muted">FB Page: {c.facebook_page_id || '—'}</div>
            <div className="muted">IG Business: {c.instagram_business_id || '—'}</div>
            <button className="secondary" style={{ marginTop: 8 }} onClick={() => { setCreating(false); setEditing(c); }}>
              Edit
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <ClientForm
          client={editing}
          creating={creating}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function ClientForm({ client, creating, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: client.name || '',
    facebook_page_id: client.facebook_page_id || '',
    facebook_page_token: client.facebook_page_token || '',
    instagram_business_id: client.instagram_business_id || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (creating) {
        await api('/clients', { method: 'POST', body: form });
      } else {
        await api(`/clients/${client.id}`, { method: 'PATCH', body: form });
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)' }}>
      <form className="card" onSubmit={submit} style={{ width: 480 }}>
        <h3>{creating ? 'New client' : `Edit ${client.name}`}</h3>
        {['name', 'facebook_page_id', 'facebook_page_token', 'instagram_business_id'].map((k) => (
          <div className="field" key={k}>
            <label>{k.replace(/_/g, ' ')}</label>
            <input
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              required={k === 'name'}
            />
          </div>
        ))}
        {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button disabled={busy}>Save</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
