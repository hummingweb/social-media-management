import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, scopeToClient } from '../middleware/auth.js';
import { refreshDesignAnalytics } from '../lib/analytics.js';

const router = Router();
router.use(requireAuth);

// Latest snapshot per platform for one design
router.get('/design/:id', async (req, res) => {
  const { data: design } = await supabaseAdmin
    .from('designs')
    .select('id, client_id, fb_post_id, ig_post_id')
    .eq('id', req.params.id)
    .single();
  if (!design) return res.status(404).json({ error: 'not found' });
  if (!scopeToClient(design.client_id, req.profile)) return res.status(403).json({ error: 'forbidden' });

  const { data } = await supabaseAdmin
    .from('post_analytics')
    .select('*')
    .eq('design_id', design.id)
    .order('fetched_at', { ascending: false });

  // Keep the most-recent row per platform
  const latest = {};
  for (const row of data || []) {
    if (!latest[row.platform]) latest[row.platform] = row;
  }
  res.json({ latest, history: data || [] });
});

// On-demand refresh for one design
router.post('/design/:id/refresh', async (req, res) => {
  const { data: design } = await supabaseAdmin
    .from('designs')
    .select('client_id')
    .eq('id', req.params.id)
    .single();
  if (!design) return res.status(404).json({ error: 'not found' });
  if (!scopeToClient(design.client_id, req.profile)) return res.status(403).json({ error: 'forbidden' });

  await refreshDesignAnalytics(req.params.id);
  res.json({ ok: true });
});

// Aggregated summary across all published designs for a client (last 30 days)
router.get('/summary', async (req, res) => {
  const clientId = req.profile.role === 'client' ? req.profile.client_id : req.query.client_id;
  if (!clientId) return res.status(400).json({ error: 'client_id required' });
  if (!scopeToClient(clientId, req.profile)) return res.status(403).json({ error: 'forbidden' });

  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: designs } = await supabaseAdmin
    .from('designs')
    .select('id, title, kind, fb_post_id, ig_post_id, updated_at')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false });

  if (!designs?.length) return res.json({ totals: emptyTotals(), per_design: [] });

  const ids = designs.map((d) => d.id);
  const { data: rows } = await supabaseAdmin
    .from('post_analytics')
    .select('*')
    .in('design_id', ids)
    .order('fetched_at', { ascending: false });

  // Bucket: design_id → platform → latest row
  const latest = {};
  for (const r of rows || []) {
    latest[r.design_id] ??= {};
    latest[r.design_id][r.platform] ??= r;
  }

  const totals = emptyTotals();
  const perDesign = designs.map((d) => {
    const fb = latest[d.id]?.facebook;
    const ig = latest[d.id]?.instagram;
    const sum = sumRows(fb, ig);
    addTotals(totals, sum);
    return { ...d, facebook: fb || null, instagram: ig || null, totals: sum };
  });

  res.json({ totals, per_design: perDesign });
});

function emptyTotals() {
  return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
}

function sumRows(...rows) {
  const out = emptyTotals();
  for (const r of rows) {
    if (!r) continue;
    for (const k of Object.keys(out)) out[k] += Number(r[k]) || 0;
  }
  return out;
}

function addTotals(acc, sum) {
  for (const k of Object.keys(acc)) acc[k] += sum[k] || 0;
}

export default router;
