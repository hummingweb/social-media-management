import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Analytics() {
  const { profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [data, setData] = useState(null);
  const isClient = profile.role === 'client';

  useEffect(() => {
    if (isClient) return;
    api('/clients').then((cs) => {
      setClients(cs);
      if (cs[0]) setClientId(cs[0].id);
    });
  }, []);

  useEffect(() => {
    const q = isClient ? '/analytics/summary' : clientId ? `/analytics/summary?client_id=${clientId}` : null;
    if (!q) return;
    api(q).then(setData).catch(console.error);
  }, [clientId, isClient]);

  if (!data) return <div>Loading…</div>;
  const t = data.totals;

  return (
    <div>
      <h2>Analytics — last 30 days</h2>

      {!isClient && (
        <div className="card">
          <div className="field">
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Stat label="Impressions" value={t.impressions} />
        <Stat label="Reach" value={t.reach} />
        <Stat label="Likes" value={t.likes} />
        <Stat label="Comments" value={t.comments} />
        <Stat label="Shares" value={t.shares} />
        <Stat label="Saves" value={t.saves} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Per-post breakdown</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Design</th>
              <th align="right">Impressions</th>
              <th align="right">Reach</th>
              <th align="right">Likes</th>
              <th align="right">Comments</th>
              <th align="right">Shares</th>
              <th align="right">Saves</th>
            </tr>
          </thead>
          <tbody>
            {data.per_design.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0' }}>
                  <Link to={`/designs/${d.id}`}>{d.title}</Link>
                  <div className="muted">{new Date(d.updated_at).toLocaleDateString()}</div>
                </td>
                <td align="right">{n(d.totals.impressions)}</td>
                <td align="right">{n(d.totals.reach)}</td>
                <td align="right">{n(d.totals.likes)}</td>
                <td align="right">{n(d.totals.comments)}</td>
                <td align="right">{n(d.totals.shares)}</td>
                <td align="right">{n(d.totals.saves)}</td>
              </tr>
            ))}
            {data.per_design.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ padding: 8 }}>
                No published posts in the last 30 days.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card">
      <div className="muted" style={{ textTransform: 'uppercase', fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{n(value)}</div>
    </div>
  );
}

function n(v) {
  return new Intl.NumberFormat().format(Number(v) || 0);
}
