// Refresh post analytics from the Meta Graph API.
//
// Runs hourly from the scheduler. For every published design in the last 30
// days we fetch the latest insights for whichever platforms it was posted to.

import { supabaseAdmin } from './supabase.js';

const VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
const GRAPH = `https://graph.facebook.com/${VERSION}`;

async function fbGet(path, params) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Insights ${path}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Per-platform fetchers — normalise the response into our column shape
// ---------------------------------------------------------------------------

async function fetchFacebookInsights({ postId, pageToken }) {
  const metrics = 'post_impressions,post_impressions_unique,post_reactions_by_type_total,post_clicks';
  const json = await fbGet(`/${postId}/insights`, { metric: metrics, access_token: pageToken });

  const get = (name) => {
    const m = json.data.find((x) => x.name === name);
    const v = m?.values?.[0]?.value;
    return typeof v === 'number' ? v : null;
  };

  const reactions = get('post_reactions_by_type_total');
  const likes =
    reactions && typeof reactions === 'object'
      ? Object.values(reactions).reduce((a, b) => a + (Number(b) || 0), 0)
      : null;

  // shares + comments live on the post object itself
  const post = await fbGet(`/${postId}`, {
    fields: 'shares,comments.summary(true)',
    access_token: pageToken,
  });

  return {
    impressions: get('post_impressions'),
    reach: get('post_impressions_unique'),
    likes,
    comments: post.comments?.summary?.total_count ?? null,
    shares: post.shares?.count ?? null,
    saves: null,
    clicks: get('post_clicks'),
    raw: { insights: json.data, post },
  };
}

async function fetchInstagramInsights({ mediaId, pageToken }) {
  const metrics = 'impressions,reach,likes,comments,saved,shares';
  const json = await fbGet(`/${mediaId}/insights`, { metric: metrics, access_token: pageToken });

  const get = (name) => {
    const m = json.data.find((x) => x.name === name);
    return m?.values?.[0]?.value ?? null;
  };

  return {
    impressions: get('impressions'),
    reach: get('reach'),
    likes: get('likes'),
    comments: get('comments'),
    shares: get('shares'),
    saves: get('saved'),
    clicks: null,
    raw: json.data,
  };
}

// ---------------------------------------------------------------------------
// Public: refresh insights for one design (used after publish + on demand)
// ---------------------------------------------------------------------------
export async function refreshDesignAnalytics(designId) {
  const { data: design } = await supabaseAdmin
    .from('designs')
    .select('*, client:client_id(facebook_page_token)')
    .eq('id', designId)
    .single();
  if (!design || design.status !== 'published') return;

  const pageToken = design.client?.facebook_page_token;
  if (!pageToken) return;

  const rows = [];

  if (design.fb_post_id) {
    try {
      const m = await fetchFacebookInsights({ postId: design.fb_post_id, pageToken });
      rows.push({ design_id: design.id, platform: 'facebook', ...m });
    } catch (e) {
      console.error('[analytics/fb]', design.id, e.message);
    }
  }

  if (design.ig_post_id) {
    try {
      const m = await fetchInstagramInsights({ mediaId: design.ig_post_id, pageToken });
      rows.push({ design_id: design.id, platform: 'instagram', ...m });
    } catch (e) {
      console.error('[analytics/ig]', design.id, e.message);
    }
  }

  if (rows.length) {
    await supabaseAdmin.from('post_analytics').insert(rows);
  }
}

// ---------------------------------------------------------------------------
// Public: hourly batch — refresh everything published in the last 30 days
// ---------------------------------------------------------------------------
export async function refreshAllRecent() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: designs } = await supabaseAdmin
    .from('designs')
    .select('id')
    .eq('status', 'published')
    .gte('updated_at', since);

  for (const d of designs || []) {
    await refreshDesignAnalytics(d.id);
  }
}
