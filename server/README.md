# SMM Server

Express API for the social media management platform.

## Setup

```bash
cp .env.example .env
# fill in Supabase, R2, Meta credentials
npm install
npm run dev
```

Run `src/db/schema.sql` in the Supabase SQL editor first.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/me | Current user + profile |
| POST   | /api/me/bootstrap | Create profile after first signup |
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

## Scheduler

`src/lib/scheduler.js` runs every minute and publishes any reserved slot whose
`scheduled_at` is in the past. It calls the Meta Graph API helpers in
`src/lib/meta.js` and writes the resulting post IDs back to `designs`.
