// Minimal Meta Graph API helpers for publishing to a Facebook Page and an
// Instagram Business account. Both flows require a long-lived Page Access
// Token stored on the client record (see schema.sql).
//
// Docs:
//   https://developers.facebook.com/docs/pages/publishing
//   https://developers.facebook.com/docs/instagram-api/guides/content-publishing

const VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
const GRAPH = `https://graph.facebook.com/${VERSION}`;

async function graph(path, { method = 'GET', body, token } = {}) {
  const url = new URL(`${GRAPH}${path}`);
  if (token && method === 'GET') url.searchParams.set('access_token', token);

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify({ ...body, access_token: token }) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`Meta API ${method} ${path} failed: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Facebook Page publishing
// ---------------------------------------------------------------------------
export async function publishToFacebookPage({ pageId, pageToken, design, assets }) {
  // Single image
  if (design.kind === 'single_image' && assets.length === 1) {
    const r = await graph(`/${pageId}/photos`, {
      method: 'POST',
      token: pageToken,
      body: { url: assets[0].url, caption: design.caption, published: true },
    });
    return r.post_id || r.id;
  }

  // Carousel — upload each photo unpublished, then attach to a feed post
  if (design.kind === 'carousel') {
    const childIds = [];
    for (const a of assets) {
      const u = await graph(`/${pageId}/photos`, {
        method: 'POST',
        token: pageToken,
        body: { url: a.url, published: false },
      });
      childIds.push(u.id);
    }
    const r = await graph(`/${pageId}/feed`, {
      method: 'POST',
      token: pageToken,
      body: {
        message: design.caption,
        attached_media: childIds.map((id) => ({ media_fbid: id })),
      },
    });
    return r.id;
  }

  // Video / Reel
  if (design.kind === 'video' || design.kind === 'reel') {
    const r = await graph(`/${pageId}/videos`, {
      method: 'POST',
      token: pageToken,
      body: { file_url: assets[0].url, description: design.caption },
    });
    return r.id;
  }

  // Story (image)
  if (design.kind === 'story') {
    const photo = await graph(`/${pageId}/photos`, {
      method: 'POST',
      token: pageToken,
      body: { url: assets[0].url, published: false },
    });
    const story = await graph(`/${pageId}/photo_stories`, {
      method: 'POST',
      token: pageToken,
      body: { photo_id: photo.id },
    });
    return story.post_id || story.id;
  }

  throw new Error(`Unsupported FB design kind: ${design.kind}`);
}

// ---------------------------------------------------------------------------
// Instagram Business publishing (via the Graph API content publishing flow)
// ---------------------------------------------------------------------------
async function createIgContainer(igUserId, token, payload) {
  return graph(`/${igUserId}/media`, { method: 'POST', token, body: payload });
}

async function publishIgContainer(igUserId, token, creationId) {
  return graph(`/${igUserId}/media_publish`, {
    method: 'POST',
    token,
    body: { creation_id: creationId },
  });
}

export async function publishToInstagram({ igUserId, pageToken, design, assets }) {
  if (design.kind === 'single_image') {
    const c = await createIgContainer(igUserId, pageToken, {
      image_url: assets[0].url,
      caption: design.caption,
    });
    const r = await publishIgContainer(igUserId, pageToken, c.id);
    return r.id;
  }

  if (design.kind === 'carousel') {
    const children = [];
    for (const a of assets) {
      const c = await createIgContainer(igUserId, pageToken, {
        image_url: a.url,
        is_carousel_item: true,
      });
      children.push(c.id);
    }
    const parent = await createIgContainer(igUserId, pageToken, {
      media_type: 'CAROUSEL',
      caption: design.caption,
      children: children.join(','),
    });
    const r = await publishIgContainer(igUserId, pageToken, parent.id);
    return r.id;
  }

  if (design.kind === 'video' || design.kind === 'reel') {
    const c = await createIgContainer(igUserId, pageToken, {
      media_type: design.kind === 'reel' ? 'REELS' : 'VIDEO',
      video_url: assets[0].url,
      caption: design.caption,
    });
    // IG video processing is async — in production poll /{container}?fields=status_code
    const r = await publishIgContainer(igUserId, pageToken, c.id);
    return r.id;
  }

  if (design.kind === 'story') {
    const c = await createIgContainer(igUserId, pageToken, {
      media_type: 'STORIES',
      image_url: assets[0].url,
    });
    const r = await publishIgContainer(igUserId, pageToken, c.id);
    return r.id;
  }

  throw new Error(`Unsupported IG design kind: ${design.kind}`);
}
