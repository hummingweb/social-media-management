import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// List clients (clients see only their own).
router.get('/', async (req, res) => {
  let query = supabaseAdmin.from('clients').select('*').order('name');
  if (req.profile.role === 'client') query = query.eq('id', req.profile.client_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create a client (admin / account_manager only).
router.post('/', requireRole('admin', 'account_manager'), async (req, res) => {
  const { name, facebook_page_id, facebook_page_token, instagram_business_id } = req.body;
  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({ name, facebook_page_id, facebook_page_token, instagram_business_id })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Update social credentials.
router.patch('/:id', requireRole('admin', 'account_manager'), async (req, res) => {
  const { name, facebook_page_id, facebook_page_token, instagram_business_id } = req.body;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (facebook_page_id !== undefined) patch.facebook_page_id = facebook_page_id;
  if (facebook_page_token !== undefined) patch.facebook_page_token = facebook_page_token;
  if (instagram_business_id !== undefined) patch.instagram_business_id = instagram_business_id;

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
