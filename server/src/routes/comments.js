import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, scopeToClient } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';

const router = Router();
router.use(requireAuth);

// Add a comment to a design (any party in the conversation can comment).
router.post('/', async (req, res) => {
  const { design_id, parent_id, body } = req.body;
  if (!design_id || !body) return res.status(400).json({ error: 'design_id and body required' });

  const { data: design } = await supabaseAdmin
    .from('designs')
    .select('id, client_id, designer_id, revision, title')
    .eq('id', design_id)
    .single();
  if (!design) return res.status(404).json({ error: 'not found' });
  if (!scopeToClient(design.client_id, req.profile)) return res.status(403).json({ error: 'forbidden' });

  const { data: comment, error } = await supabaseAdmin
    .from('comments')
    .insert({
      design_id,
      parent_id: parent_id || null,
      body,
      author_id: req.profile.id,
      revision: design.revision,
    })
    .select('*, author:author_id(full_name, role)')
    .single();
  if (error) return res.status(400).json({ error: error.message });

  // Notify the other side of the conversation.
  const recipient =
    req.profile.role === 'client' ? design.designer_id : null;
  if (recipient && recipient !== req.profile.id) {
    await notify({
      userId: recipient,
      designId: design.id,
      kind: 'comment',
      body: `${req.profile.full_name} commented on "${design.title}".`,
    });
  }

  res.status(201).json(comment);
});

export default router;
