import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const CHART_COLORS = {
  impressions: '#4f8cff',
  reach: '#2ea36b',
  likes: '#e0584c',
  engagement: '#d6a23a',
};

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

  // Derive engagement = likes + comments + shares + saves for the line chart
  const timeseries = (data.timeseries || []).map((row) => ({
    ...row,
    engagement: (row.likes || 0) + (row.comments || 0) + (row.shares || 0) + (row.saves || 0),
    label: new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  const topPosts = [...data.per_design]
    .sort((a, b) => (b.totals.impressions || 0) - (a.totals.impressions || 0))
    .slice(0, 10)
    .map((d) => ({
      name: d.title.length > 20 ? d.title.slice(0, 18) + '…' : d.title,
      impressions: d.totals.impressions || 0,
      reach: d.totals.reach || 0,
      engagement:
        (d.totals.likes || 0) + (d.totals.comments || 0) + (d.totals.shares || 0) + (d.totals.saves || 0),
    }));

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
        <h3 style={{ marginTop: 0 }}>Daily performance</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          Summed across all posts published each day.
        </div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeseries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#262b35" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#8a93a6" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8a93a6" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#181b22', border: '1px solid #262b35', borderRadius: 6 }}
                labelStyle={{ color: '#e7eaf0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="impressions" stroke={CHART_COLORS.impressions} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reach" stroke={CHART_COLORS.reach} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="engagement" stroke={CHART_COLORS.engagement} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Top posts by impressions</h3>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topPosts} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid stroke="#262b35" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#8a93a6" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
              <YAxis stroke="#8a93a6" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#181b22', border: '1px solid #262b35', borderRadius: 6 }}
                labelStyle={{ color: '#e7eaf0' }}
                cursor={{ fill: 'rgba(79,140,255,0.08)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="impressions" fill={CHART_COLORS.impressions} />
              <Bar dataKey="engagement" fill={CHART_COLORS.engagement} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {topPosts.length === 0 && <div className="muted">No published posts yet.</div>}
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
