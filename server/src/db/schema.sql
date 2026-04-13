-- Social Media Management Platform — Postgres / Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'account_manager', 'designer', 'client');

create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null,
  role                user_role not null,
  client_id           uuid,              -- set when role = 'client'
  email               text,              -- mirrored from auth.users for notifications
  slack_webhook_url   text,              -- optional per-user Slack DM webhook
  notify_email        boolean not null default true,
  notify_slack        boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Clients (the agency's customers)
-- ----------------------------------------------------------------------------
create table if not exists clients (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  facebook_page_id         text,
  facebook_page_token      text,         -- long-lived page access token
  instagram_business_id    text,
  created_at               timestamptz not null default now()
);

alter table profiles
  add constraint profiles_client_fk
  foreign key (client_id) references clients(id) on delete set null;

-- ----------------------------------------------------------------------------
-- Calendar slots — predefined publishing windows per client
-- ----------------------------------------------------------------------------
create type slot_status as enum ('open', 'reserved', 'published', 'failed');

create table if not exists calendar_slots (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  scheduled_at timestamptz not null,
  status      slot_status not null default 'open',
  design_id   uuid,                      -- filled when reserved
  created_at  timestamptz not null default now()
);

create index if not exists calendar_slots_client_time_idx
  on calendar_slots (client_id, scheduled_at);

-- ----------------------------------------------------------------------------
-- Designs (a creative being reviewed)
-- ----------------------------------------------------------------------------
create type design_status as enum (
  'draft',           -- designer working
  'in_review',       -- waiting on client
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'failed'
);

create type design_kind as enum (
  'single_image',
  'carousel',
  'video',
  'reel',
  'story'
);

create table if not exists designs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  designer_id uuid not null references profiles(id),
  title       text not null,
  caption     text not null default '',
  kind        design_kind not null,
  status      design_status not null default 'draft',
  revision    int not null default 1,
  slot_id     uuid references calendar_slots(id) on delete set null,
  publish_to_facebook  boolean not null default true,
  publish_to_instagram boolean not null default true,
  fb_post_id  text,
  ig_post_id  text,
  publish_error text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table calendar_slots
  add constraint calendar_slots_design_fk
  foreign key (design_id) references designs(id) on delete set null;

-- A design can have multiple media files (carousel)
create table if not exists design_assets (
  id          uuid primary key default gen_random_uuid(),
  design_id   uuid not null references designs(id) on delete cascade,
  position    int not null default 0,
  url         text not null,             -- public R2 URL
  mime_type   text not null,
  size_bytes  bigint not null,
  created_at  timestamptz not null default now()
);

create index if not exists design_assets_design_idx on design_assets(design_id);

-- ----------------------------------------------------------------------------
-- Threaded comments on designs (revision conversation)
-- ----------------------------------------------------------------------------
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  design_id   uuid not null references designs(id) on delete cascade,
  author_id   uuid not null references profiles(id),
  parent_id   uuid references comments(id) on delete cascade,
  body        text not null,
  revision    int not null,              -- which design revision this targets
  created_at  timestamptz not null default now()
);

create index if not exists comments_design_idx on comments(design_id, created_at);

-- ----------------------------------------------------------------------------
-- In-app notifications
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  design_id   uuid references designs(id) on delete cascade,
  kind        text not null,             -- 'review_requested' | 'comment' | 'approved' | 'changes' | 'published' | 'failed'
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on notifications(user_id, read_at);

-- ----------------------------------------------------------------------------
-- Trigger: keep designs.updated_at fresh
-- ----------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists designs_touch on designs;
create trigger designs_touch
  before update on designs
  for each row execute function touch_updated_at();
