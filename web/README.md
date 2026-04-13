# SMM Web

React + Vite frontend.

## Setup

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Vite proxies `/api` → `http://localhost:4000` so the Express server can run side by side.

## Pages

| Path | Description |
|------|-------------|
| `/login` | Email/password sign-in (Supabase Auth) |
| `/` | Dashboard with status counts and recent activity |
| `/designs` | Filterable grid of all designs |
| `/designs/new` | Designer/AM uploads a creative |
| `/designs/:id` | Preview, comments, approve/reject, schedule |
| `/calendar` | Per-client slot management |
| `/clients` | Admin/AM manage client + FB/IG credentials |
