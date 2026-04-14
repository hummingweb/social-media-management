import { Router } from 'express';
import { stripe } from '../lib/stripe.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || 'http://localhost:5173';

// Resolve the client whose subscription the caller is allowed to manage.
// - role 'client' → their own client_id
// - admin / AM    → anything they pass via ?client_id=
async function resolveClient(req) {
  let id = req.profile.role === 'client' ? req.profile.client_id : req.query.client_id || req.body?.client_id;
  if (!id) return null;
  const { data } = await supabaseAdmin.from('clients').select('*').eq('id', id).single();
  return data;
}

// ---------------------------------------------------------------------------
// List active plans (public to any authenticated user)
// ---------------------------------------------------------------------------
router.get('/plans', requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---------------------------------------------------------------------------
// Current subscription summary for the caller's client
// ---------------------------------------------------------------------------
router.get('/subscription', requireAuth, async (req, res) => {
  const client = await resolveClient(req);
  if (!client) return res.status(404).json({ error: 'no client in scope' });

  const { data: plan } = client.plan_id
    ? await supabaseAdmin.from('plans').select('*').eq('id', client.plan_id).single()
    : { data: null };

  // Count posts published this billing period for usage display.
  const periodStart = client.current_period_end
    ? new Date(new Date(client.current_period_end).getTime() - 30 * 86400000)
    : new Date(Date.now() - 30 * 86400000);

  const { count: postsThisPeriod } = await supabaseAdmin
    .from('designs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('status', 'published')
    .gte('updated_at', periodStart.toISOString());

  res.json({
    client_id: client.id,
    plan,
    status: client.subscription_status || 'none',
    current_period_end: client.current_period_end,
    cancel_at_period_end: client.cancel_at_period_end,
    posts_this_period: postsThisPeriod || 0,
    monthly_post_limit: plan?.monthly_post_limit ?? null,
  });
});

// ---------------------------------------------------------------------------
// Start a Stripe Checkout session for a brand-new subscription
// ---------------------------------------------------------------------------
router.post('/checkout', requireAuth, async (req, res) => {
  const { plan_id } = req.body;
  const client = await resolveClient(req);
  if (!client) return res.status(404).json({ error: 'no client in scope' });

  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('*')
    .eq('id', plan_id)
    .single();
  if (!plan) return res.status(400).json({ error: 'unknown plan' });

  // Reuse / create a Stripe Customer for this client.
  let customerId = client.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: client.name,
      metadata: { client_id: client.id },
    });
    customerId = customer.id;
    await supabaseAdmin.from('clients').update({ stripe_customer_id: customerId }).eq('id', client.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${PUBLIC_WEB_URL}/billing?success=1`,
    cancel_url: `${PUBLIC_WEB_URL}/billing?canceled=1`,
    subscription_data: { metadata: { client_id: client.id, plan_id: plan.id } },
    metadata: { client_id: client.id, plan_id: plan.id },
  });

  res.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// Customer Portal — handles upgrade, downgrade, cancel, payment method, etc.
// ---------------------------------------------------------------------------
router.post('/portal', requireAuth, async (req, res) => {
  const client = await resolveClient(req);
  if (!client?.stripe_customer_id) {
    return res.status(400).json({ error: 'client has no Stripe customer' });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripe_customer_id,
    return_url: `${PUBLIC_WEB_URL}/billing`,
  });
  res.json({ url: session.url });
});

export default router;
