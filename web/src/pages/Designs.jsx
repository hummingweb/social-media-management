import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Designs() {
  const { profile } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api('/designs').then(setDesigns).catch(console.error);
  }, []);

  const visible = filter === 'all' ? designs : designs.filter((d) => d.status === filter);
  const canCreate = profile.role !== 'client';

  return (
    <div>
      <div className="row between">
        <h2>Designs</h2>
        {canCreate && (
          <Link to="/designs/new"><button>+ New design</button></Link>
        )}
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {['all', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published'].map((s) => (
          <button
            key={s}
            className={filter === s ? '' : 'secondary'}
            onClick={() => setFilter(s)}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-3">
        {visible.map((d) => {
          const cover = d.assets?.[0];
          return (
            <Link key={d.id} to={`/designs/${d.id}`} className="card" style={{ display: 'block', color: 'inherit' }}>
              {cover && cover.mime_type.startsWith('image/') ? (
                <img className="thumb" src={cover.url} alt="" />
              ) : (
                <div className="thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="muted">{d.kind}</span>
                </div>
              )}
              <div className="row between" style={{ marginTop: 12 }}>
                <strong>{d.title}</strong>
                <span className={`badge ${d.status}`}>{d.status.replace('_', ' ')}</span>
              </div>
              <div className="muted">{d.client?.name} · rev {d.revision}</div>
            </Link>
          );
        })}
        {visible.length === 0 && <div className="muted">No designs yet.</div>}
      </div>
    </div>
  );
}
