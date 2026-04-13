import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function DesignDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [design, setDesign] = useState(null);
  const [comment, setComment] = useState('');
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api(`/designs/${id}`);
    setDesign(d);
    if (d.status === 'approved') {
      const s = await api(`/slots?client_id=${d.client_id}&status=open`);
      setSlots(s);
    }
  }

  useEffect(() => { load().catch(console.error); }, [id]);

  if (!design) return <div>Loading…</div>;

  const isClient = profile.role === 'client';
  const isStaff = profile.role === 'designer' || profile.role === 'account_manager' || profile.role === 'admin';

  async function postComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    await api('/comments', { method: 'POST', body: { design_id: id, body: comment } });
    setComment('');
    await load();
  }

  async function approve() {
    setBusy(true);
    try { await api(`/designs/${id}/approve`, { method: 'POST' }); await load(); }
    finally { setBusy(false); }
  }

  async function requestChanges() {
    if (!comment.trim()) return alert('Please describe what should change.');
    setBusy(true);
    try {
      await api(`/designs/${id}/request-changes`, { method: 'POST', body: { body: comment } });
      setComment('');
      await load();
    } finally { setBusy(false); }
  }

  async function reserveSlot(slotId) {
    setBusy(true);
    try { await api(`/slots/${slotId}/reserve`, { method: 'POST', body: { design_id: id } }); await load(); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="row between">
        <div>
          <h2 style={{ marginBottom: 4 }}>{design.title}</h2>
          <div className="muted">
            {design.client?.name} · {design.kind} · revision {design.revision}
          </div>
        </div>
        <span className={`badge ${design.status}`}>{design.status.replace('_', ' ')}</span>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {design.assets.map((a) =>
          a.mime_type.startsWith('image/') ? (
            <img key={a.id} className="thumb" src={a.url} alt="" />
          ) : (
            <video key={a.id} className="thumb" src={a.url} controls />
          )
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <strong>Caption</strong>
        <p style={{ whiteSpace: 'pre-wrap' }}>{design.caption || <span className="muted">(none)</span>}</p>
      </div>

      {design.status === 'approved' && isStaff && (
        <div className="card">
          <strong>Schedule to a slot</strong>
          <div className="muted" style={{ marginBottom: 8 }}>Pick an open calendar slot for {design.client.name}.</div>
          {slots.length === 0 && <div className="muted">No open slots — create some on the Calendar page.</div>}
          {slots.map((s) => (
            <div key={s.id} className="row between" style={{ padding: '6px 0' }}>
              <span>{new Date(s.scheduled_at).toLocaleString()}</span>
              <button disabled={busy} onClick={() => reserveSlot(s.id)}>Reserve</button>
            </div>
          ))}
        </div>
      )}

      {design.status === 'scheduled' && (
        <div className="card">
          Scheduled for <strong>{new Date(design.slot.scheduled_at).toLocaleString()}</strong>
        </div>
      )}

      {design.publish_error && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <strong>Publish error:</strong> {design.publish_error}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Conversation</h3>
        {design.comments.length === 0 && <div className="muted">No comments yet.</div>}
        {design.comments.map((c) => (
          <div key={c.id} className="comment">
            <div>
              <span className="author">{c.author?.full_name}</span>
              <span className="when">rev {c.revision} · {new Date(c.created_at).toLocaleString()}</span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
          </div>
        ))}

        <form onSubmit={postComment} style={{ marginTop: 16 }}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isClient ? 'Leave feedback or notes…' : 'Reply to the client…'}
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="submit" className="secondary">Comment</button>
            {(isClient || isStaff) && design.status === 'in_review' && (
              <>
                <button type="button" className="success" disabled={busy} onClick={approve}>
                  Approve
                </button>
                <button type="button" className="danger" disabled={busy} onClick={requestChanges}>
                  Request changes
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
