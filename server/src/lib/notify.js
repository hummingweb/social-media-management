import { supabaseAdmin } from './supabase.js';

// Insert an in-app notification. (Email / Slack / WhatsApp deferred to v2.)
export async function notify({ userId, designId, kind, body }) {
  if (!userId) return;
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({ user_id: userId, design_id: designId, kind, body });
  if (error) console.error('[notify]', error);
}

// Notify every user with one of the given roles (optionally filtered by client).
export async function notifyRoles({ roles, clientId, designId, kind, body }) {
  let query = supabaseAdmin.from('profiles').select('id').in('role', roles);
  if (clientId) query = query.or(`client_id.eq.${clientId},role.in.(admin,account_manager)`);
  const { data: users } = await query;
  for (const u of users || []) {
    await notify({ userId: u.id, designId, kind, body });
  }
}
