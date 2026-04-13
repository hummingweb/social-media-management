-- Row-Level Security policies for the social media management platform.
--
-- The Express server uses the SUPABASE_SERVICE_ROLE_KEY which BYPASSES RLS,
-- so the application logic is unaffected. These policies are defense in depth
-- for anyone reaching the database with the anon key (e.g. directly from the
-- React app or via a leaked token).
--
-- Run this AFTER schema.sql.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function current_profile() returns profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'account_manager', 'designer')
  );
$$;

create or replace function is_admin_or_am() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'account_manager')
  );
$$;

create or replace function my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every user-facing table
-- ---------------------------------------------------------------------------
alter table profiles        enable row level security;
alter table clients         enable row level security;
alter table calendar_slots  enable row level security;
alter table designs         enable row level security;
alter table design_assets   enable row level security;
alter table comments        enable row level security;
alter table notifications   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: every user can read their own profile; staff can read all
-- ---------------------------------------------------------------------------
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_staff());

drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles
  for update using (is_admin_or_am()) with check (is_admin_or_am());

-- ---------------------------------------------------------------------------
-- clients: staff sees all, client users see only their own
-- ---------------------------------------------------------------------------
drop policy if exists clients_read on clients;
create policy clients_read on clients
  for select using (is_staff() or id = my_client_id());

drop policy if exists clients_admin_write on clients;
create policy clients_admin_write on clients
  for all using (is_admin_or_am()) with check (is_admin_or_am());

-- ---------------------------------------------------------------------------
-- calendar_slots
-- ---------------------------------------------------------------------------
drop policy if exists slots_read on calendar_slots;
create policy slots_read on calendar_slots
  for select using (is_staff() or client_id = my_client_id());

drop policy if exists slots_staff_write on calendar_slots;
create policy slots_staff_write on calendar_slots
  for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- designs (and the assets that hang off them)
-- ---------------------------------------------------------------------------
drop policy if exists designs_read on designs;
create policy designs_read on designs
  for select using (is_staff() or client_id = my_client_id());

drop policy if exists designs_staff_write on designs;
create policy designs_staff_write on designs
  for all using (is_staff()) with check (is_staff());

-- Clients can only update *their own* designs to flip the status (approve /
-- request changes). Service-role still bypasses this, so the API enforces
-- which transitions are legal.
drop policy if exists designs_client_update on designs;
create policy designs_client_update on designs
  for update using (client_id = my_client_id())
  with check (client_id = my_client_id());

drop policy if exists assets_read on design_assets;
create policy assets_read on design_assets
  for select using (
    exists (
      select 1 from designs d
      where d.id = design_assets.design_id
        and (is_staff() or d.client_id = my_client_id())
    )
  );

drop policy if exists assets_staff_write on design_assets;
create policy assets_staff_write on design_assets
  for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- comments: visible to anyone who can see the parent design
-- ---------------------------------------------------------------------------
drop policy if exists comments_read on comments;
create policy comments_read on comments
  for select using (
    exists (
      select 1 from designs d
      where d.id = comments.design_id
        and (is_staff() or d.client_id = my_client_id())
    )
  );

drop policy if exists comments_insert on comments;
create policy comments_insert on comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from designs d
      where d.id = comments.design_id
        and (is_staff() or d.client_id = my_client_id())
    )
  );

-- ---------------------------------------------------------------------------
-- notifications: each user sees only their own
-- ---------------------------------------------------------------------------
drop policy if exists notifications_self on notifications;
create policy notifications_self on notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_self_update on notifications;
create policy notifications_self_update on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
