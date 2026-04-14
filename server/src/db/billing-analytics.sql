-- Stripe billing + post analytics — second migration.
-- Run AFTER schema.sql.

-- ---------------------------------------------------------------------------
-- Plans (seed your own Stripe Prices and reference them here)
-- ---------------------------------------------------------------------------
create table if not exists plans (
  id                  text primary key,         -- 'starter' | 'pro' | 'agency'
  name                text not null,
  stripe_price_id     text not null,
  monthly_post_limit  int,                      -- null = unlimited
  monthly_price_cents int not null,
  features            jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  sort_order          int not null default 0
);

insert into plans (id, name, stripe_price_id, monthly_post_limit, monthly_price_cents, sort_order)
values
  ('starter', 'Starter', 'price_REPLACE_ME_starter', 10,  4900, 1),
  ('pro',     'Pro',     'price_REPLACE_ME_pro',     30,  9900, 2),
  ('agency',  'Agency',  'price_REPLACE_ME_agency',  null, 24900, 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Extend clients with Stripe subscription state
-- ---------------------------------------------------------------------------
alter table clients
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_id                text references plans(id),
  add column if not exists subscription_status    text,        -- active|trialing|past_due|canceled|unpaid|incomplete|none
  add column if not exists current_period_end     timestamptz,
  add column if not exists cancel_at_period_end   boolean not null default false;

create index if not exists clients_stripe_customer_idx on clients(stripe_customer_id);

-- ---------------------------------------------------------------------------
-- Per-post analytics, refreshed periodically from Meta Insights
-- ---------------------------------------------------------------------------
create table if not exists post_analytics (
  id          uuid primary key default gen_random_uuid(),
  design_id   uuid not null references designs(id) on delete cascade,
  platform    text not null,         -- 'facebook' | 'instagram'
  fetched_at  timestamptz not null default now(),
  impressions int,
  reach       int,
  likes       int,
  comments    int,
  shares      int,
  saves       int,
  clicks      int,
  raw         jsonb
);

create index if not exists post_analytics_design_idx
  on post_analytics(design_id, platform, fetched_at desc);
