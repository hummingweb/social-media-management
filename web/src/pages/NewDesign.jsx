import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function NewDesign() {
  const nav = useNavigate();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [kind, setKind] = useState('single_image');
  const [files, setFiles] = useState([]);
  const [fb, setFb] = useState(true);
  const [ig, setIg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/clients').then((cs) => {
      setClients(cs);
      if (cs[0]) setClientId(cs[0].id);
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('client_id', clientId);
      fd.append('title', title);
      fd.append('caption', caption);
      fd.append('kind', kind);
      fd.append('publish_to_facebook', String(fb));
      fd.append('publish_to_instagram', String(ig));
      for (const f of files) fd.append('files', f);
      const created = await api('/designs', { method: 'POST', formData: fd });
      nav(`/designs/${created.id}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>New design</h2>
      <form className="card" onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="field">
          <label>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Title (internal)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Caption (will be posted)</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="single_image">Single image</option>
            <option value="carousel">Carousel</option>
            <option value="video">Video</option>
            <option value="reel">Reel</option>
            <option value="story">Story</option>
          </select>
        </div>
        <div className="field">
          <label>Files</label>
          <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
        </div>
        <div className="field">
          <label><input type="checkbox" checked={fb} onChange={(e) => setFb(e.target.checked)} /> Publish to Facebook</label>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={ig} onChange={(e) => setIg(e.target.checked)} /> Publish to Instagram</label>
        </div>
        {err && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{err}</div>}
        <button disabled={busy || !files.length}>{busy ? 'Uploading…' : 'Submit for review'}</button>
      </form>
    </div>
  );
}
