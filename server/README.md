# SMM Server

Express API for the social media management platform.

## Setup

```bash
cp .env.example .env
# fill in Supabase, R2, Meta credentials
npm install
npm run dev
```

In the Supabase SQL editor, run:
1. `src/db/schema.sql` — tables, enums, triggers
2. `src/db/billing-analytics.sql` — Stripe billing + post-analytics tables
3. `src/db/rls.sql` — row-level security policies (defense in depth; the server
   bypasses RLS via the service-role key but the anon key is locked down)

Then update the `plans` table with your real Stripe Price IDs.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/me | Current user + profile |
| POST   | /api/me/bootstrap | Create profile after first signup |
| PATCH  | /api/me/preferences | Update notification channel preferences |
| GET    | /api/clients | List clients |
| POST   | /api/clients | Create client (admin/AM) |
| PATCH  | /api/clients/:id | Update client (admin/AM) |
| GET    | /api/designs | List designs |
| GET    | /api/designs/:id | Design detail with comments |
| POST   | /api/designs | Upload new design (multipart) |
| POST   | /api/designs/:id/request-changes | Bump revision |
| POST   | /api/designs/:id/resubmit | Designer reuploads |
| POST   | /api/designs/:id/approve | Approve |
| POST   | /api/comments | Add comment to a design |
| GET    | /api/slots | List calendar slots |
| POST   | /api/slots | Create slots (bulk) |
| POST   | /api/slots/:id/reserve | Schedule an approved design |
| GET    | /api/notifications | Current user's notifications |
| GET    | /api/oauth/meta/start | Begin Meta OAuth (popup window) |
| GET    | /api/oauth/meta/callback | OAuth callback — persists Page + IG creds |
| GET    | /api/billing/plans | List active plans |
| GET    | /api/billing/subscription | Current sub + usage for caller's client |
| POST   | /api/billing/checkout | Create a Stripe Checkout session |
| POST   | /api/billing/portal | Create a Stripe Customer Portal session |
| POST   | /api/billing/webhook | Stripe webhook (raw body, signature verified) |
| GET    | /api/analytics/design/:id | Latest insights for one design |
| POST   | /api/analytics/design/:id/refresh | Force a refresh from Meta |
| GET    | /api/analytics/summary | 30-day aggregated client analytics |

## Notifications

`src/lib/notify.js` writes an in-app notification row and then fans out to
the user's enabled channels:

- **Email** — via Resend (`RESEND_API_KEY`). Uses the email from `auth.users`.
- **Personal Slack** — each user can paste their own incoming-webhook URL on
  the Settings page.
- **Agency Slack** — set `SLACK_WEBHOOK_URL` to mirror every event to a single
  team channel.

Channels with missing credentials silently no-op so local dev still works.

## Meta OAuth

Set the redirect URI `http://localhost:4000/api/oauth/meta/callback` in your
Meta App dashboard. The "Connect Facebook" button on the Clients page opens a
popup; on success the server stores the Page Access Token and linked IG
Business id on the client row.

Required permissions: `pages_show_list`, `pages_manage_posts`,
`pages_read_engagement`, `business_management`, `instagram_basic`,
`instagram_content_publish`.

## Billing (Stripe)

Clients are billed per-`clients` row. Each client has a Stripe Customer; the
upgrade/downgrade/cancel flows are delegated entirely to the **Stripe Customer
Portal**, so we don't have to build any of those screens. New subscriptions
go through Stripe Checkout.

The webhook (`/api/billing/webhook`) is mounted *before* `express.json()` so
that the raw body is preserved for signature verification. It listens for
`checkout.session.completed` and `customer.subscription.*` events and mirrors
status / period end / plan id back onto the `clients` row.

Post-creation enforces `monthly_post_limit` from `plans` — if the limit is
reached, `POST /api/designs` returns 402 with an upgrade message.

## Analytics

`src/lib/analytics.js` calls the Meta Insights API for each published design:

- Facebook posts: `post_impressions`, `post_impressions_unique`, reactions,
  `post_clicks`, plus shares/comments from the post object
- Instagram media: `impressions`, `reach`, `likes`, `comments`, `saved`, `shares`

Snapshots are inserted into `post_analytics` and accumulate over time, so you
can chart history later. The scheduler refreshes everything published in the
last 30 days once an hour, plus a one-shot snapshot ~5 minutes after each
publish.

## Scheduler

`src/lib/scheduler.js` runs every minute and publishes any reserved slot whose
`scheduled_at` is in the past. It calls the Meta Graph API helpers in
`src/lib/meta.js` and writes the resulting post IDs back to `designs`. It
also runs an hourly job that refreshes analytics for recently published posts.
