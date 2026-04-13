import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Dashboard() {
  const { profile } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    api('/designs').then(setDesigns).catch(console.error);
    api('/notifications').then(setNotifs).catch(console.error);
  }, []);

  const counts = designs.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h2>Welcome, {profile.full_name.split(' ')[0]}</h2>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {['in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'failed'].map((k) => (
          <div key={k} className="card">
            <div className="muted" style={{ textTransform: 'uppercase' }}>{k.replace('_', ' ')}</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{counts[k] || 0}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Recent activity</h3>
          <Link to="/designs">See all designs →</Link>
        </div>
        <ul style={{ paddingLeft: 18 }}>
          {notifs.slice(0, 8).map((n) => (
            <li key={n.id} style={{ marginBottom: 6 }}>
              {n.design_id ? <Link to={`/designs/${n.design_id}`}>{n.body}</Link> : n.body}
              <span className="muted"> · {new Date(n.created_at).toLocaleString()}</span>
            </li>
          ))}
          {notifs.length === 0 && <li className="muted">Nothing yet.</li>}
        </ul>
      </div>
    </div>
  );
}
