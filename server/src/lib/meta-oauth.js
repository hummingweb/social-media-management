// Meta (Facebook) OAuth flow for connecting a client's Page + IG Business
// account without manual token pasting.
//
// Flow:
//   1. Frontend opens /api/oauth/meta/start?client_id=<id>
//   2. Server redirects to Facebook's OAuth dialog
//   3. Facebook redirects back to /api/oauth/meta/callback?code=...&state=...
//   4. Server exchanges code -> short-lived user token -> long-lived user token
//   5. Server lists pages, finds the one the user picked (or the first one),
//      grabs its Page Access Token + linked IG Business id, and writes them
//      onto the clients row.
//
// Required Meta App permissions:
//   - pages_show_list
//   - pages_manage_posts
//   - pages_read_engagement
//   - business_management
//   - instagram_basic
//   - instagram_content_publish

const VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;

const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

export function buildAuthorizeUrl({ redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: SCOPES,
  });
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${params}`;
}

async function fbGet(path, params) {
  const url = new URL(`https://graph.facebook.com/${VERSION}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Meta OAuth ${path} failed: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

export async function exchangeCodeForLongLivedToken({ code, redirectUri }) {
  const short = await fbGet('/oauth/access_token', {
    client_id: APP_ID,
    client_secret: APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  const long = await fbGet('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: short.access_token,
  });

  return long.access_token;
}

// Returns the first page (or one matching pageId if provided) along with its
// linked Instagram Business account, if any.
export async function fetchPageAndInstagram({ userToken, pageId }) {
  const pages = await fbGet('/me/accounts', {
    access_token: userToken,
    fields: 'id,name,access_token,instagram_business_account',
  });

  if (!pages.data?.length) {
    throw new Error('No Facebook pages found for this user.');
  }

  const page = pageId ? pages.data.find((p) => p.id === pageId) : pages.data[0];
  if (!page) throw new Error(`Page ${pageId} not found.`);

  return {
    pageId: page.id,
    pageName: page.name,
    pageToken: page.access_token, // already long-lived because the user token was
    instagramBusinessId: page.instagram_business_account?.id || null,
    allPages: pages.data.map((p) => ({ id: p.id, name: p.name })),
  };
}
