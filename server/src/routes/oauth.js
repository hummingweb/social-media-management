import { Router } from 'express';
import crypto from 'node:crypto';
import { supabaseAdmin, authenticateRequest } from '../lib/supabase.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForLongLivedToken,
  fetchPageAndInstagram,
} from '../lib/meta-oauth.js';

const router = Router();

// In-memory state store (sufficient for one server). For HA, use Redis.
const stateStore = new Map();

function callbackUri(req) {
  return `${req.protocol}://${req.get('host')}/api/oauth/meta/callback`;
}

// ---------------------------------------------------------------------------
// Start: redirect user to Facebook's OAuth dialog
// ---------------------------------------------------------------------------
// Auth comes from a short-lived access_token query param (set by the frontend
// so the redirect works in a popup window without a JSON header).
router.get('/meta/start', async (req, res) => {
  const { client_id, access_token } = req.query;
  if (!client_id || !access_token) return res.status(400).send('client_id and access_token required');

  const session = await authenticateRequest(`Bearer ${access_token}`);
  if (!session?.profile || !['admin', 'account_manager'].includes(session.profile.role)) {
    return res.status(403).send('forbidden');
  }

  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, { clientId: client_id, userId: session.user.id, ts: Date.now() });

  // Garbage-collect old states
  for (const [k, v] of stateStore) if (Date.now() - v.ts > 10 * 60 * 1000) stateStore.delete(k);

  res.redirect(buildAuthorizeUrl({ redirectUri: callbackUri(req), state }));
});

// ---------------------------------------------------------------------------
// Callback: exchange the code, persist tokens, close the popup
// ---------------------------------------------------------------------------
router.get('/meta/callback', async (req, res) => {
  const { code, state, error_description } = req.query;
  if (error_description) return renderClose(res, false, error_description);
  if (!code || !state) return renderClose(res, false, 'Missing code or state');

  const entry = stateStore.get(state);
  if (!entry) return renderClose(res, false, 'Invalid or expired state');
  stateStore.delete(state);

  try {
    const userToken = await exchangeCodeForLongLivedToken({
      code,
      redirectUri: callbackUri(req),
    });
    const page = await fetchPageAndInstagram({ userToken });

    const { error } = await supabaseAdmin
      .from('clients')
      .update({
        facebook_page_id: page.pageId,
        facebook_page_token: page.pageToken,
        instagram_business_id: page.instagramBusinessId,
      })
      .eq('id', entry.clientId);
    if (error) throw new Error(error.message);

    renderClose(res, true, `Connected ${page.pageName}`);
  } catch (err) {
    console.error('[oauth/meta] failed:', err);
    renderClose(res, false, err.message);
  }
});

function renderClose(res, ok, message) {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!doctype html>
<html><body style="font-family:sans-serif;background:#0f1115;color:#e7eaf0;padding:40px;text-align:center">
  <h2 style="color:${ok ? '#2ea36b' : '#e0584c'}">${ok ? 'Connected' : 'Connection failed'}</h2>
  <p>${message}</p>
  <script>
    if (window.opener) { window.opener.postMessage({ type: 'meta-oauth', ok: ${ok} }, '*'); }
    setTimeout(() => window.close(), 1500);
  </script>
</body></html>`);
}

export default router;
