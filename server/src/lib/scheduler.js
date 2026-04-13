import cron from 'node-cron';
import { supabaseAdmin } from './supabase.js';
import { publishToFacebookPage, publishToInstagram } from './meta.js';
import { notify } from './notify.js';

// Runs every minute, finds slots that are due, publishes them.
export function startScheduler() {
  cron.schedule('* * * * *', runOnce);
  console.log('[scheduler] started — checking every minute');
}

export async function runOnce() {
  const nowIso = new Date().toISOString();

  const { data: dueSlots, error } = await supabaseAdmin
    .from('calendar_slots')
    .select('*, designs:design_id(*)')
    .eq('status', 'reserved')
    .lte('scheduled_at', nowIso);

  if (error) {
    console.error('[scheduler] query failed:', error);
    return;
  }
  if (!dueSlots?.length) return;

  for (const slot of dueSlots) {
    const design = slot.designs;
    if (!design || design.status !== 'scheduled') continue;
    await publishDesign(design, slot);
  }
}

async function publishDesign(design, slot) {
  console.log(`[scheduler] publishing design ${design.id}`);

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', design.client_id)
    .single();

  const { data: assets } = await supabaseAdmin
    .from('design_assets')
    .select('*')
    .eq('design_id', design.id)
    .order('position');

  let fbPostId = null;
  let igPostId = null;
  let publishError = null;

  try {
    if (design.publish_to_facebook && client.facebook_page_id && client.facebook_page_token) {
      fbPostId = await publishToFacebookPage({
        pageId: client.facebook_page_id,
        pageToken: client.facebook_page_token,
        design,
        assets,
      });
    }
    if (design.publish_to_instagram && client.instagram_business_id && client.facebook_page_token) {
      igPostId = await publishToInstagram({
        igUserId: client.instagram_business_id,
        pageToken: client.facebook_page_token,
        design,
        assets,
      });
    }
  } catch (err) {
    publishError = err.message;
    console.error(`[scheduler] publish failed for ${design.id}:`, err);
  }

  const success = !publishError;

  await supabaseAdmin
    .from('designs')
    .update({
      status: success ? 'published' : 'failed',
      fb_post_id: fbPostId,
      ig_post_id: igPostId,
      publish_error: publishError,
    })
    .eq('id', design.id);

  await supabaseAdmin
    .from('calendar_slots')
    .update({ status: success ? 'published' : 'failed' })
    .eq('id', slot.id);

  await notify({
    userId: design.designer_id,
    designId: design.id,
    kind: success ? 'published' : 'failed',
    body: success
      ? `"${design.title}" was published to ${client.name}.`
      : `Publishing "${design.title}" failed: ${publishError}`,
  });
}
