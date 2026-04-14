import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import meRouter from './routes/me.js';
import clientsRouter from './routes/clients.js';
import designsRouter from './routes/designs.js';
import commentsRouter from './routes/comments.js';
import slotsRouter from './routes/slots.js';
import notificationsRouter from './routes/notifications.js';
import oauthRouter from './routes/oauth.js';
import billingRouter from './routes/billing.js';
import billingWebhookRouter from './routes/billing-webhook.js';
import analyticsRouter from './routes/analytics.js';
import { startScheduler } from './lib/scheduler.js';

const app = express();
app.use(cors({ origin: process.env.PUBLIC_WEB_URL || true, credentials: true }));

// IMPORTANT: Stripe webhook must receive the raw body so signatures verify.
// Mount it BEFORE express.json() so it isn't parsed.
app.use('/api/billing/webhook', billingWebhookRouter);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/me', meRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/designs', designsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/billing', billingRouter);
app.use('/api/analytics', analyticsRouter);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'server error' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`[smm] api listening on :${port}`);
  startScheduler();
});
