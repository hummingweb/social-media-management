import { supabaseAdmin } from './supabase.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'SMM <notifications@example.com>';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL; // agency-wide channel
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Insert an in-app notification AND fan it out to the user's enabled channels.
export async function notify({ userId, designId, kind, body }) {
  if (!userId) return;

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, slack_webhook_url, notify_email, notify_slack')
    .eq('id', userId)
    .single();
  if (error || !profile) {
    console.error('[notify] profile lookup failed', error);
    return;
  }

  await supabaseAdmin
    .from('notifications')
    .insert({ user_id: userId, design_id: designId, kind, body });

  const link = designId ? `${PUBLIC_WEB_URL}/designs/${designId}` : PUBLIC_WEB_URL;

  if (profile.notify_email && profile.email) {
    sendEmail({ to: profile.email, subject: subjectFor(kind), body, link }).catch((e) =>
      console.error('[notify/email]', e)
    );
  }

  if (profile.notify_slack && profile.slack_webhook_url) {
    sendSlack({ url: profile.slack_webhook_url, body, link }).catch((e) =>
      console.error('[notify/slack-user]', e)
    );
  }

  // Mirror everything to the agency Slack channel if configured.
  if (SLACK_WEBHOOK_URL) {
    sendSlack({ url: SLACK_WEBHOOK_URL, body: `*${profile.full_name}*: ${body}`, link }).catch((e) =>
      console.error('[notify/slack-agency]', e)
    );
  }
}

// Notify every user with one of the given roles (optionally scoped to a client).
export async function notifyRoles({ roles, clientId, designId, kind, body }) {
  let query = supabaseAdmin.from('profiles').select('id, role, client_id').in('role', roles);
  const { data: users } = await query;
  const filtered = (users || []).filter((u) => {
    if (u.role === 'admin' || u.role === 'account_manager' || u.role === 'designer') return true;
    return !clientId || u.client_id === clientId;
  });
  for (const u of filtered) {
    await notify({ userId: u.id, designId, kind, body });
  }
}

// ---------------------------------------------------------------------------
// Channel implementations
// ---------------------------------------------------------------------------

function subjectFor(kind) {
  switch (kind) {
    case 'review_requested':  return '[SMM] New design ready for review';
    case 'comment':           return '[SMM] New comment on a design';
    case 'changes':           return '[SMM] Changes requested';
    case 'approved':          return '[SMM] Design approved';
    case 'published':         return '[SMM] Design published';
    case 'failed':            return '[SMM] Publishing failed';
    default:                  return '[SMM] Notification';
  }
}

async function sendEmail({ to, subject, body, link }) {
  if (!RESEND_API_KEY) return;
  const html = `
    <div style="font-family:sans-serif;font-size:14px;line-height:1.5">
      <p>${escapeHtml(body)}</p>
      <p><a href="${link}">Open in SMM →</a></p>
    </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendSlack({ url, body, link }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${body}\n<${link}|Open in SMM>`,
    }),
  });
  if (!res.ok) throw new Error(`Slack ${res.status}`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
