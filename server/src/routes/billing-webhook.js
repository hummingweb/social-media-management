import express, { Router } from 'express';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../lib/stripe.js';
import { supabaseAdmin } from '../lib/supabase.js';

// Stripe requires the raw body to verify signatures, so this router is
// mounted *before* the global express.json() middleware in index.js.
const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[stripe webhook] bad signature:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await handleEvent(event);
    } catch (err) {
      console.error('[stripe webhook] handler failed:', err);
      return res.status(500).send('handler failed');
    }

    res.json({ received: true });
  }
);

async function handleEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      // Pull the subscription so we can capture status + period end + plan
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      await applySubscription(sub);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await applySubscription(event.data.object);
      break;
    }
    default:
      // Ignore everything else for now
      break;
  }
}

async function applySubscription(sub) {
  const clientId = sub.metadata?.client_id;
  if (!clientId) {
    console.warn('[stripe webhook] subscription has no client_id metadata', sub.id);
    return;
  }

  // Match the price back to one of our plans.
  const priceId = sub.items?.data?.[0]?.price?.id;
  let planId = sub.metadata?.plan_id || null;
  if (!planId && priceId) {
    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('stripe_price_id', priceId)
      .single();
    planId = plan?.id || null;
  }

  await supabaseAdmin
    .from('clients')
    .update({
      stripe_subscription_id: sub.id,
      plan_id: planId,
      subscription_status: sub.status,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: !!sub.cancel_at_period_end,
    })
    .eq('id', clientId);
}

export default router;
