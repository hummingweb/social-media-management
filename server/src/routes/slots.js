import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole, scopeToClient } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// List calendar slots for a client.
router.get('/', async (req, res) => {
  const { client_id, status } = req.query;
  let query = supabaseAdmin
    .from('calendar_slots')
    .select('*, design:design_id(id, title, status)')
    .order('scheduled_at');
  if (client_id) query = query.eq('client_id', client_id);
  if (status) query = query.eq('status', status);

  if (req.profile.role === 'client') query = query.eq('client_id', req.profile.client_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create one or many slots (admin / AM).
// Body: { client_id, slots: [iso_datetime, ...] }
router.post('/', requireRole('admin', 'account_manager'), async (req, res) => {
  const { client_id, slots } = req.body;
  if (!client_id || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'client_id and slots[] required' });
  }
  const rows = slots.map((iso) => ({ client_id, scheduled_at: iso }));
  const { data, error } = await supabaseAdmin.from('calendar_slots').insert(rows).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Reserve an open slot for an approved design (links them and marks as scheduled).
router.post('/:id/reserve', requireRole('admin', 'account_manager', 'designer'), async (req, res) => {
  const { design_id } = req.body;

  const { data: slot } = await supabaseAdmin
    .from('calendar_slots')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (!slot) return res.status(404).json({ error: 'slot not found' });
  if (slot.status !== 'open') return res.status(409).json({ error: 'slot not open' });

  const { data: design } = await supabaseAdmin
    .from('designs')
    .select('*')
    .eq('id', design_id)
    .single();
  if (!design) return res.status(404).json({ error: 'design not found' });
  if (design.client_id !== slot.client_id) {
    return res.status(400).json({ error: 'design and slot belong to different clients' });
  }
  if (design.status !== 'approved') {
    return res.status(400).json({ error: 'design must be approved before scheduling' });
  }
  if (!scopeToClient(design.client_id, req.profile)) return res.status(403).json({ error: 'forbidden' });

  await supabaseAdmin
    .from('calendar_slots')
    .update({ status: 'reserved', design_id: design.id })
    .eq('id', slot.id);

  const { data: updated } = await supabaseAdmin
    .from('designs')
    .update({ status: 'scheduled', slot_id: slot.id })
    .eq('id', design.id)
    .select()
    .single();

  res.json(updated);
});

export default router;
