import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase.js';
import { uploadBuffer } from '../lib/r2.js';
import { requireAuth, requireRole, scopeToClient } from '../middleware/auth.js';
import { notify, notifyRoles } from '../lib/notify.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.use(requireAuth);

// ---------------------------------------------------------------------------
// List designs visible to the current user
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('designs')
    .select('*, client:client_id(name), assets:design_assets(*)')
    .order('updated_at', { ascending: false });

  if (req.profile.role === 'client') query = query.eq('client_id', req.profile.client_id);
  if (req.query.client_id) query = query.eq('client_id', req.query.client_id);
  if (req.query.status) query = query.eq('status', req.query.status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---------------------------------------------------------------------------
// Get a single design with assets and comment thread
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { data: design, error } = await supabaseAdmin
    .from('designs')
    .select('*, client:client_id(*), assets:design_assets(*), slot:slot_id(*)')
    .eq('id', req.params.id)
    .single();
  if (error || !design) return res.status(404).json({ error: 'not found' });
  if (!scopeToClient(design.client_id, req.profile)) return res.status(403).json({ error: 'forbidden' });

  const { data: comments } = await supabaseAdmin
    .from('comments')
    .select('*, author:author_id(full_name, role)')
    .eq('design_id', design.id)
    .order('created_at');

  res.json({ ...design, comments: comments || [] });
});

// ---------------------------------------------------------------------------
// Create a design (designers + AMs)
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireRole('designer', 'account_manager', 'admin'),
  upload.array('files', 10),
  async (req, res) => {
    const { client_id, title, caption, kind, publish_to_facebook, publish_to_instagram } = req.body;

    if (!req.files?.length) return res.status(400).json({ error: 'at least one file required' });

    const { data: design, error } = await supabaseAdmin
      .from('designs')
      .insert({
        client_id,
        designer_id: req.profile.id,
        title,
        caption: caption || '',
        kind,
        status: 'in_review',
        publish_to_facebook: publish_to_facebook !== 'false',
        publish_to_instagram: publish_to_instagram !== 'false',
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    const assets = [];
    for (let i = 0; i < req.files.length; i++) {
      const f = req.files[i];
      const url = await uploadBuffer({
        buffer: f.buffer,
        mimeType: f.mimetype,
        originalName: f.originalname,
      });
      assets.push({
        design_id: design.id,
        position: i,
        url,
        mime_type: f.mimetype,
        size_bytes: f.size,
      });
    }
    await supabaseAdmin.from('design_assets').insert(assets);

    await notifyRoles({
      roles: ['client'],
      clientId: client_id,
      designId: design.id,
      kind: 'review_requested',
      body: `New design "${title}" is ready for your review.`,
    });

    res.status(201).json(design);
  }
);

// ---------------------------------------------------------------------------
// Client requests changes — bumps revision, status -> changes_requested
// ---------------------------------------------------------------------------
router.post('/:id/request-changes', async (req, res) => {
  const { data: design } = await supabaseAdmin
    .from('designs')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!design) return res.status(404).json({ error: 'not found' });
  if (!scopeToClient(design.client_id, req.profile)) return res.status(403).json({ error: 'forbidden' });
  if (req.profile.role !== 'client' && req.profile.role !== 'account_manager' && req.profile.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { data: updated } = await supabaseAdmin
    .from('designs')
    .update({ status: 'changes_requested', revision: design.revision + 1 })
    .eq('id', design.id)
    .select()
    .single();

  if (req.body.body) {
    await supabaseAdmin.from('comments').insert({
      design_id: design.id,
      author_id: req.profile.id,
      body: req.body.body,
      revision: updated.revision,
    });
  }

  await notify({
    userId: design.designer_id,
    designId: design.id,
    kind: 'changes',
    body: `Changes requested on "${design.title}".`,
  });

  res.json(updated);
});

// ---------------------------------------------------------------------------
// Designer resubmits a revised design (status -> in_review)
// ---------------------------------------------------------------------------
router.post(
  '/:id/resubmit',
  requireRole('designer', 'account_manager', 'admin'),
  upload.array('files', 10),
  async (req, res) => {
    const { data: design } = await supabaseAdmin
      .from('designs')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!design) return res.status(404).json({ error: 'not found' });

    if (req.files?.length) {
      // Replace the asset list with the new upload
      await supabaseAdmin.from('design_assets').delete().eq('design_id', design.id);
      const assets = [];
      for (let i = 0; i < req.files.length; i++) {
        const f = req.files[i];
        const url = await uploadBuffer({
          buffer: f.buffer,
          mimeType: f.mimetype,
          originalName: f.originalname,
        });
        assets.push({
          design_id: design.id,
          position: i,
          url,
          mime_type: f.mimetype,
          size_bytes: f.size,
        });
      }
      await supabaseAdmin.from('design_assets').insert(assets);
    }

    const patch = { status: 'in_review' };
    if (req.body.caption !== undefined) patch.caption = req.body.caption;

    const { data: updated } = await supabaseAdmin
      .from('designs')
      .update(patch)
      .eq('id', design.id)
      .select()
      .single();

    await notifyRoles({
      roles: ['client'],
      clientId: design.client_id,
      designId: design.id,
      kind: 'review_requested',
      body: `Revision ${design.revision} of "${design.title}" is ready for review.`,
    });

    res.json(updated);
  }
);

// ---------------------------------------------------------------------------
// Approve a design
// ---------------------------------------------------------------------------
router.post('/:id/approve', async (req, res) => {
  const { data: design } = await supabaseAdmin
    .from('designs')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!design) return res.status(404).json({ error: 'not found' });
  if (!scopeToClient(design.client_id, req.profile)) return res.status(403).json({ error: 'forbidden' });

  const { data: updated } = await supabaseAdmin
    .from('designs')
    .update({ status: 'approved' })
    .eq('id', design.id)
    .select()
    .single();

  await notifyRoles({
    roles: ['account_manager', 'designer'],
    clientId: design.client_id,
    designId: design.id,
    kind: 'approved',
    body: `"${design.title}" was approved by the client.`,
  });

  res.json(updated);
});

export default router;
