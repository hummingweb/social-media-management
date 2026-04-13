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
2. `src/db/rls.sql` — row-level security policies (defense in depth; the server
   bypasses RLS via the service-role key but the anon key is locked down)

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

## Scheduler

`src/lib/scheduler.js` runs every minute and publishes any reserved slot whose
`scheduled_at` is in the past. It calls the Meta Graph API helpers in
`src/lib/meta.js` and writes the resulting post IDs back to `designs`.
