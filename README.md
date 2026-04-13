# Social Media Management Platform

A workflow tool for design agencies: designers upload creative, clients review and leave threaded feedback, and approved posts are auto-published to the client's Facebook Page and Instagram Business account on calendar slots.

## Stack

- **Backend**: Node.js + Express
- **Frontend**: React (Vite)
- **Database + Auth**: Supabase (Postgres + Auth)
- **File storage**: Cloudflare R2 (S3-compatible)
- **Publishing**: Meta Graph API (Facebook + Instagram)
- **Scheduler**: in-process cron worker

## Roles

- **Admin** — manages users, clients, slot templates
- **Account Manager** — assigns designs to clients, oversees workflow
- **Designer** — uploads creative, responds to revision requests
- **Client** — reviews designs, leaves comments, approves

## Workflow

```
Designer uploads ──► Client reviews ──► Comments / revisions ──► Approval
                                                                    │
                                                                    ▼
                                                       Scheduled to calendar slot
                                                                    │
                                                                    ▼
                                                  Auto-published to FB Page + IG
```

## Project layout

```
server/   Express API
web/      React SPA
```

See `server/README.md` and `web/README.md` for setup instructions.

## Quick start

```bash
# 1. Set up Supabase project, run server/src/db/schema.sql
# 2. Create Cloudflare R2 bucket
# 3. Create Meta App with pages_manage_posts + instagram_content_publish
# 4. Configure server/.env and web/.env

cd server && npm install && npm run dev
cd web && npm install && npm run dev
```

## MVP scope

- [x] Supabase auth (email/password) with role-based access
- [x] Designer upload to R2 (single image, carousel, video, stories)
- [x] Threaded comments + revision rounds
- [x] Approval workflow
- [x] Calendar slot templates (e.g. Mon/Wed/Fri 10am)
- [x] Auto-publish to Facebook Page + Instagram Business at slot time
- [x] In-app notifications

## Out of scope (v2)

- Email / Slack / WhatsApp notification channels
- Multi-tenant / multi-agency SaaS mode
- LinkedIn, X, TikTok publishing
- Pinpoint annotation comments on images
