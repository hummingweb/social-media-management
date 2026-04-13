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
import { startScheduler } from './lib/scheduler.js';

const app = express();
app.use(cors({ origin: process.env.PUBLIC_WEB_URL || true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/me', meRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/designs', designsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/oauth', oauthRouter);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'server error' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`[smm] api listening on :${port}`);
  startScheduler();
});
