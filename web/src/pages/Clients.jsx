import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() { setClients(await api('/clients')); }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    function onMessage(e) {
      if (e.data?.type === 'meta-oauth') load();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  async function connectFacebook(clientId) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const url = `/api/oauth/meta/start?client_id=${clientId}&access_token=${encodeURIComponent(token)}`;
    window.open(url, 'meta-oauth', 'width=600,height=700');
  }

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
            <div className="row" style={{ marginTop: 8 }}>
              <button className="secondary" onClick={() => { setCreating(false); setEditing(c); }}>
                Edit
              </button>
              <button onClick={() => connectFacebook(c.id)}>
                {c.facebook_page_id ? 'Reconnect Facebook' : 'Connect Facebook'}
              </button>
            </div>
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
