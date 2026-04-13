import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

router.get('/', requireUser, (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

// Bootstrap a profile after Supabase auth signup. Self-serve for the very
// first admin; AMs/admins can also create profiles for designers/clients.
router.post('/bootstrap', requireUser, async (req, res) => {
  if (req.profile) return res.json(req.profile);
  const { full_name, role, client_id } = req.body;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({ id: req.user.id, full_name, role, client_id: client_id || null })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

export default router;
