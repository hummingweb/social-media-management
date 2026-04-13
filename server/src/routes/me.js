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
    .insert({
      id: req.user.id,
      full_name,
      role,
      client_id: client_id || null,
      email: req.user.email,           // mirror for notification fan-out
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Update the current user's notification preferences.
router.patch('/preferences', requireUser, async (req, res) => {
  if (!req.profile) return res.status(404).json({ error: 'no profile' });
  const { notify_email, notify_slack, slack_webhook_url } = req.body;
  const patch = {};
  if (notify_email !== undefined) patch.notify_email = !!notify_email;
  if (notify_slack !== undefined) patch.notify_slack = !!notify_slack;
  if (slack_webhook_url !== undefined) patch.slack_webhook_url = slack_webhook_url || null;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(patch)
    .eq('id', req.user.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
