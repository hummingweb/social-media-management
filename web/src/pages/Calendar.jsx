import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Calendar() {
  const { profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState('');
  const canEdit = profile.role === 'admin' || profile.role === 'account_manager';

  useEffect(() => {
    api('/clients').then((cs) => {
      setClients(cs);
      if (cs[0]) setClientId(cs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!clientId) return;
    api(`/slots?client_id=${clientId}`).then(setSlots);
  }, [clientId]);

  async function addSlot(e) {
    e.preventDefault();
    if (!newSlot) return;
    const iso = new Date(newSlot).toISOString();
    await api('/slots', { method: 'POST', body: { client_id: clientId, slots: [iso] } });
    setNewSlot('');
    setSlots(await api(`/slots?client_id=${clientId}`));
  }

  return (
    <div>
      <h2>Calendar slots</h2>

      <div className="card">
        <div className="field">
          <label>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {canEdit && (
          <form onSubmit={addSlot} className="row" style={{ marginTop: 8 }}>
            <input type="datetime-local" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
            <button>Add slot</button>
          </form>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Upcoming</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">When</th>
              <th align="left">Status</th>
              <th align="left">Design</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0' }}>{new Date(s.scheduled_at).toLocaleString()}</td>
                <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                <td>{s.design ? s.design.title : <span className="muted">—</span>}</td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr><td colSpan={3} className="muted" style={{ padding: 8 }}>No slots yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
