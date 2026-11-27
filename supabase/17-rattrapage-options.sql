-- SiteClic : rattrapage complet (SQL 13 + 15 + 16), 27/11/2026. Sans danger si déjà exécuté en partie.
create table if not exists public.site_visits (
  site_id uuid not null references public.sites (id) on delete cascade,
  day date not null,
  visits int not null default 0,
  primary key (site_id, day)
);
alter table public.site_visits enable row level security;
drop policy if exists "site_visits_owner" on public.site_visits;
create policy "site_visits_owner" on public.site_visits for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
create or replace function public.visit_hit(p_slug text)
returns void language plpgsql security definer set search_path = public
as $$
declare sid uuid;
begin
  select id into sid from public.sites where slug = p_slug and status = 'en_ligne';
  if sid is null then return; end if;
  insert into public.site_visits (site_id, day, visits) values (sid, (now() at time zone 'Europe/Paris')::date, 1)
  on conflict (site_id, day) do update set visits = public.site_visits.visits + 1;
end;
$$;
revoke all on function public.visit_hit(text) from public;
grant execute on function public.visit_hit(text) to anon, authenticated;
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null,
  phone text not null,
  pickup text not null,
  items jsonb not null default '[]',
  total int not null default 0,          -- centimes
  note text not null default '',
  status text not null default 'nouvelle', -- nouvelle, prete, retiree, annulee
  pay_session text,
  created_at timestamptz not null default now()
);
create index if not exists orders_site_idx on public.orders (site_id, created_at desc);
alter table public.orders enable row level security;
drop policy if exists "orders_owner_select" on public.orders;
create policy "orders_owner_select" on public.orders for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "orders_owner_update" on public.orders;
create policy "orders_owner_update" on public.orders for update to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "orders_owner_delete" on public.orders;
create policy "orders_owner_delete" on public.orders for delete to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
create or replace function public.place_order(p_slug text, p_name text, p_phone text, p_pickup text, p_items jsonb, p_total int, p_note text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare sid uuid; oid uuid;
begin
  select id into sid from public.sites where slug = p_slug and status = 'en_ligne';
  if sid is null then raise exception 'commande_indisponible'; end if;
  if length(trim(p_name)) not between 1 and 80 or length(trim(p_phone)) not between 6 and 30
     or length(p_pickup) > 40 or jsonb_array_length(p_items) not between 1 and 40 or p_total not between 1 and 500000 then
    raise exception 'commande_invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('order:' || sid::text));
  if (select count(*) from public.orders where site_id = sid and created_at > now() - interval '1 day') >= 80 then
    raise exception 'commande_trop';
  end if;
  insert into public.orders (site_id, name, phone, pickup, items, total, note)
  values (sid, trim(p_name), trim(p_phone), p_pickup, p_items, p_total, left(coalesce(p_note, ''), 300))
  returning id into oid;
  return oid;
end;
$$;
revoke all on function public.place_order(text, text, text, text, jsonb, int, text) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, int, text) to anon, authenticated;
create or replace function public.attach_order_payment(p_order uuid, p_session text)
returns void language sql security definer set search_path = public
as $$ update public.orders set pay_session = p_session
      where id = p_order and pay_session is null and created_at > now() - interval '15 minutes' and p_session ~ '^cs_[A-Za-z0-9_]{10,200}$' $$;
revoke all on function public.attach_order_payment(uuid, text) from public;
grant execute on function public.attach_order_payment(uuid, text) to anon, authenticated;
create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  code text not null unique,
  amount int not null,                   -- centimes
  buyer text not null default '',
  recipient text not null default '',
  message text not null default '',
  pay_session text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gift_cards_site_idx on public.gift_cards (site_id, created_at desc);
alter table public.gift_cards enable row level security;
drop policy if exists "gift_owner_select" on public.gift_cards;
create policy "gift_owner_select" on public.gift_cards for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "gift_owner_update" on public.gift_cards;
create policy "gift_owner_update" on public.gift_cards for update to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
create or replace function public.create_gift(p_slug text, p_amount int, p_buyer text, p_recipient text, p_message text)
returns table (id uuid, code text) language plpgsql security definer set search_path = public
as $$
declare sid uuid; c text; gid uuid;
begin
  select s.id into sid from public.sites s where s.slug = p_slug and s.status = 'en_ligne';
  if sid is null or p_amount not between 1000 and 50000 then raise exception 'cadeau_invalide'; end if;
  if (select count(*) from public.gift_cards g where g.site_id = sid and g.created_at > now() - interval '1 day') >= 40 then
    raise exception 'cadeau_trop';
  end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.gift_cards (site_id, code, amount, buyer, recipient, message)
  values (sid, c, p_amount, left(coalesce(p_buyer, ''), 80), left(coalesce(p_recipient, ''), 80), left(coalesce(p_message, ''), 300))
  returning gift_cards.id into gid;
  return query select gid, c;
end;
$$;
revoke all on function public.create_gift(text, int, text, text, text) from public;
grant execute on function public.create_gift(text, int, text, text, text) to anon, authenticated;
create or replace function public.attach_gift_payment(p_gift uuid, p_session text)
returns void language sql security definer set search_path = public
as $$ update public.gift_cards set pay_session = p_session
      where id = p_gift and pay_session is null and created_at > now() - interval '15 minutes' and p_session ~ '^cs_[A-Za-z0-9_]{10,200}$' $$;
revoke all on function public.attach_gift_payment(uuid, text) from public;
grant execute on function public.attach_gift_payment(uuid, text) to anon, authenticated;
create or replace function public.gift_by_session(p_session text)
returns table (code text, amount int, recipient text, message text, site_name text)
language sql stable security definer set search_path = public
as $$ select g.code, g.amount, g.recipient, g.message, s.name from public.gift_cards g join public.sites s on s.id = g.site_id
      where g.pay_session = p_session and p_session ~ '^cs_[A-Za-z0-9_]{10,200}$' $$;
revoke all on function public.gift_by_session(text) from public;
grant execute on function public.gift_by_session(text) to anon, authenticated;
alter table public.reservations add column if not exists kind text not null default 'table';  -- table, rdv
alter table public.reservations add column if not exists service text not null default '';
alter table public.reservations add column if not exists duration int not null default 0;     -- minutes (rendez-vous)
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check check (status in ('nouvelle', 'confirmee', 'refusee', 'attente'));
create or replace function public.book_appointment(
  p_slug text, p_name text, p_phone text, p_day date, p_time text, p_service text, p_staff text, p_minutes int, p_message text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid; team int; busy int; total int;
  st text := left(trim(coalesce(p_staff, '')), 30);
  t0 time; t1 time;
begin
  select s.id, greatest(1, coalesce(jsonb_array_length(s.published_content -> 'appointments' -> 'staff'), 0)) into sid, team
  from public.sites s
  where s.slug = p_slug and s.status = 'en_ligne' and (s.published_content -> 'appointments' ->> 'enabled')::boolean
  limit 1;
  if sid is null then raise exception 'rdv_indisponible'; end if;
  if length(trim(p_name)) not between 1 and 80 or length(trim(p_phone)) not between 6 and 30
     or p_day < current_date or p_day > current_date + 120 or p_time !~ '^[0-2][0-9]:[0-5][0-9]$'
     or p_minutes not between 10 and 480 or length(coalesce(p_service, '')) > 60 or length(coalesce(p_message, '')) > 300 then
    raise exception 'rdv_invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('rdv:' || sid::text));
  if (select count(*) from public.reservations r where r.site_id = sid and r.created_at > now() - interval '1 day') >= 60 then
    raise exception 'reservation_trop';
  end if;
  t0 := p_time::time; t1 := t0 + make_interval(mins => p_minutes);
  select count(*), count(*) filter (where r.table_label = st) into total, busy from public.reservations r
  where r.site_id = sid and r.kind = 'rdv' and r.day = p_day and r.status in ('nouvelle', 'confirmee')
    and r.time::time < t1 and r.time::time + make_interval(mins => greatest(r.duration, 10)) > t0;
  if (st <> '' and busy > 0) or total >= team then raise exception 'creneau_pris'; end if;
  insert into public.reservations (site_id, name, phone, day, time, people, message, table_label, kind, service, duration)
  values (sid, trim(p_name), trim(p_phone), p_day, p_time, 1, coalesce(trim(p_message), ''), st, 'rdv', left(trim(coalesce(p_service, '')), 60), p_minutes);
  return true;
end;
$$;
revoke all on function public.book_appointment(text, text, text, date, text, text, text, int, text) from public;
grant execute on function public.book_appointment(text, text, text, date, text, text, text, int, text) to anon, authenticated;
create or replace function public.appointment_busy(p_slug text, p_day date)
returns table (at_time text, minutes int, staff text)
language sql stable security definer set search_path = public
as $$
  select r.time, greatest(r.duration, 10), r.table_label
  from public.reservations r join public.sites s on s.id = r.site_id
  where s.slug = p_slug and s.status = 'en_ligne' and r.kind = 'rdv' and r.day = p_day and r.status in ('nouvelle', 'confirmee')
  order by r.time;
$$;
revoke all on function public.appointment_busy(text, date) from public;
grant execute on function public.appointment_busy(text, date) to anon, authenticated;
create or replace function public.join_waitlist(p_slug text, p_name text, p_phone text, p_day date, p_time text, p_people int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare sid uuid;
begin
  select s.id into sid from public.sites s where s.slug = p_slug and s.status = 'en_ligne' limit 1;
  if sid is null then raise exception 'reservation_indisponible'; end if;
  if length(trim(p_name)) not between 1 and 80 or length(trim(p_phone)) not between 6 and 30
     or p_people not between 1 and 30 or p_day < current_date or p_day > current_date + 60 or p_time !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'reservation_invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('table:' || sid::text));
  if (select count(*) from public.reservations r where r.site_id = sid and r.created_at > now() - interval '1 day') >= 60 then
    raise exception 'reservation_trop';
  end if;
  insert into public.reservations (site_id, name, phone, day, time, people, message, status)
  values (sid, trim(p_name), trim(p_phone), p_day, p_time, p_people, '', 'attente');
  return true;
end;
$$;
revoke all on function public.join_waitlist(text, text, text, date, text, int) from public;
grant execute on function public.join_waitlist(text, text, text, date, text, int) to anon, authenticated;
alter table public.sites add column if not exists loyalty_secret uuid not null default gen_random_uuid();
create table if not exists public.loyalty_stamps (
  id bigserial primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  card uuid not null,
  day date not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, card, day)
);
create index if not exists loyalty_card_idx on public.loyalty_stamps (site_id, card);
alter table public.loyalty_stamps enable row level security;
drop policy if exists "loyalty_owner_select" on public.loyalty_stamps;
create policy "loyalty_owner_select" on public.loyalty_stamps for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
create table if not exists public.loyalty_fails (
  site_id uuid not null references public.sites (id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (site_id, day)
);
alter table public.loyalty_fails enable row level security;
revoke all on table public.loyalty_fails from anon, authenticated;
create or replace function public.loyalty_day_code(p_secret uuid, p_day date)
returns text language sql immutable
as $$ select lpad((('x' || substr(md5(p_secret::text || p_day::text), 1, 7))::bit(28)::int % 10000)::text, 4, '0') $$;
revoke all on function public.loyalty_day_code(uuid, date) from public;
create or replace function public.loyalty_code(p_site uuid)
returns text language sql stable security definer set search_path = public
as $$ select public.loyalty_day_code(s.loyalty_secret, (now() at time zone 'Europe/Paris')::date)
      from public.sites s where s.id = p_site and s.user_id = auth.uid() $$;
revoke all on function public.loyalty_code(uuid) from public;
grant execute on function public.loyalty_code(uuid) to authenticated;
create or replace function public.loyalty_count(p_slug text, p_card uuid)
returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from public.loyalty_stamps l join public.sites s on s.id = l.site_id
      where s.slug = p_slug and l.card = p_card and l.redeemed_at is null $$;
revoke all on function public.loyalty_count(text, uuid) from public;
grant execute on function public.loyalty_count(text, uuid) to anon, authenticated;
create or replace function public.loyalty_use(p_slug text, p_card uuid, p_code text, p_redeem boolean)
returns int language plpgsql security definer set search_path = public
as $$
declare
  sid uuid; secret uuid; goal int; today date := (now() at time zone 'Europe/Paris')::date; fails int; n int;
begin
  select s.id, s.loyalty_secret, coalesce((s.published_content -> 'loyalty' ->> 'goal')::int, 10) into sid, secret, goal
  from public.sites s
  where s.slug = p_slug and s.status = 'en_ligne' and (s.published_content -> 'loyalty' ->> 'enabled')::boolean limit 1;
  if sid is null then raise exception 'fidelite_indisponible'; end if;
  perform pg_advisory_xact_lock(hashtext('fid:' || sid::text));
  select coalesce((select f.n from public.loyalty_fails f where f.site_id = sid and f.day = today), 0) into fails;
  if fails >= 30 then return -2; end if;
  if p_code is distinct from public.loyalty_day_code(secret, today) then
    insert into public.loyalty_fails (site_id, day, n) values (sid, today, 1)
    on conflict (site_id, day) do update set n = public.loyalty_fails.n + 1;
    return -1;
  end if;
  select count(*) into n from public.loyalty_stamps where site_id = sid and card = p_card and redeemed_at is null;
  if p_redeem then
    if n < goal then return -4; end if;
    update public.loyalty_stamps set redeemed_at = now()
    where id in (select id from public.loyalty_stamps where site_id = sid and card = p_card and redeemed_at is null order by day limit goal);
    return n - goal;
  end if;
  if (select count(*) from public.loyalty_stamps where site_id = sid and created_at > now() - interval '1 day') >= 500 then return -2; end if;
  insert into public.loyalty_stamps (site_id, card, day) values (sid, p_card, today) on conflict do nothing;
  if not found then return -3; end if;
  return n + 1;
end;
$$;
revoke all on function public.loyalty_use(text, uuid, text, boolean) from public;
grant execute on function public.loyalty_use(text, uuid, text, boolean) to anon, authenticated;
create table if not exists public.server_key (
  id int primary key default 1 check (id = 1),
  hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.server_key enable row level security;
revoke all on table public.server_key from anon, authenticated;
create or replace function public.server_key_set(p_hash text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_team_session() then raise exception 'reserve_proprietaire'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'cle_invalide'; end if;
  insert into public.server_key (id, hash) values (1, p_hash)
  on conflict (id) do update set hash = excluded.hash, updated_at = now() where public.server_key.hash <> excluded.hash;
  return true;
end;
$$;
revoke all on function public.server_key_set(text) from public;
grant execute on function public.server_key_set(text) to authenticated;
create or replace function public.server_key_ok(p_key text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.server_key where hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex'));
$$;
revoke all on function public.server_key_ok(text) from public;
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_owner_select" on public.push_subscriptions;
create policy "push_owner_select" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "push_owner_delete" on public.push_subscriptions;
create policy "push_owner_delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
revoke all on table public.push_subscriptions from anon;
grant select, delete on table public.push_subscriptions to authenticated;
create or replace function public.push_save(p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'connexion'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) not between 20 and 200 or length(p_auth) not between 8 and 100 then
    raise exception 'abonnement_invalide';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  delete from public.push_subscriptions where user_id = auth.uid() and endpoint not in (
    select endpoint from public.push_subscriptions where user_id = auth.uid() order by created_at desc limit 5);
  return true;
end;
$$;
revoke all on function public.push_save(text, text, text) from public;
grant execute on function public.push_save(text, text, text) to authenticated;
create or replace function public.push_targets(p_key text, p_slug text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.server_key_ok(p_key) then raise exception 'cle_serveur'; end if;
  return query select p.endpoint, p.p256dh, p.auth from public.push_subscriptions p
    join public.sites s on s.user_id = p.user_id where s.slug = p_slug;
end;
$$;
revoke all on function public.push_targets(text, text) from public;
grant execute on function public.push_targets(text, text) to anon, authenticated;
create or replace function public.push_forget(p_key text, p_endpoint text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.server_key_ok(p_key) then raise exception 'cle_serveur'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;
revoke all on function public.push_forget(text, text) from public;
grant execute on function public.push_forget(text, text) to anon, authenticated;
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  contact text not null,
  kind text not null check (kind in ('email', 'sms')),
  created_at timestamptz not null default now(),
  unique (site_id, contact)
);
create or replace function public.site_week(p_site uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'visits', (select coalesce(sum(visits), 0) from public.site_visits where site_id = p_site and day >= p_from and day < p_to),
    'reservations', (select count(*) from public.reservations where site_id = p_site and kind <> 'rdv' and status <> 'attente'
                       and (created_at at time zone 'Europe/Paris')::date >= p_from and (created_at at time zone 'Europe/Paris')::date < p_to),
    'rdv', (select count(*) from public.reservations where site_id = p_site and kind = 'rdv'
                       and (created_at at time zone 'Europe/Paris')::date >= p_from and (created_at at time zone 'Europe/Paris')::date < p_to),
    'orders', (select count(*) from public.orders where site_id = p_site and status <> 'annulee'
                       and (created_at at time zone 'Europe/Paris')::date >= p_from and (created_at at time zone 'Europe/Paris')::date < p_to),
    'sales', (select coalesce(sum(total), 0) from public.orders where site_id = p_site and status <> 'annulee'
                       and (created_at at time zone 'Europe/Paris')::date >= p_from and (created_at at time zone 'Europe/Paris')::date < p_to),
    'subscribers', (select count(*) from public.subscribers where site_id = p_site and (created_at at time zone 'Europe/Paris')::date >= p_from and (created_at at time zone 'Europe/Paris')::date < p_to)
  );
$$;
revoke all on function public.site_week(uuid, date, date) from public;
create or replace function public.my_week()
returns jsonb language sql stable security definer set search_path = public
as $$
  with d as (select (now() at time zone 'Europe/Paris')::date + 1 as t)
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
           'now', public.site_week(s.id, d.t - 7, d.t), 'before', public.site_week(s.id, d.t - 14, d.t - 7)) order by s.created_at), '[]')
  from public.sites s, d where s.user_id = auth.uid() and s.status = 'en_ligne';
$$;
revoke all on function public.my_week() from public;
grant execute on function public.my_week() to authenticated;
create table if not exists public.weekly_sent (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.weekly_sent enable row level security;
revoke all on table public.weekly_sent from anon, authenticated;
create or replace function public.weekly_due(p_key text)
returns table (endpoint text, p256dh text, auth text, body text)
language plpgsql security definer set search_path = public
as $$
declare u record; t date := (now() at time zone 'Europe/Paris')::date; w jsonb; txt text;
begin
  if not public.server_key_ok(p_key) then raise exception 'cle_serveur'; end if;
  for u in select distinct p.user_id from public.push_subscriptions p
           where not exists (select 1 from public.weekly_sent ws where ws.user_id = p.user_id and ws.sent_at > now() - interval '6 days') loop
    select jsonb_build_object(
      'visits', coalesce(sum((public.site_week(s.id, t - 7, t)->>'visits')::int), 0),
      'res', coalesce(sum((public.site_week(s.id, t - 7, t)->>'reservations')::int + (public.site_week(s.id, t - 7, t)->>'rdv')::int), 0),
      'orders', coalesce(sum((public.site_week(s.id, t - 7, t)->>'orders')::int), 0),
      'sales', coalesce(sum((public.site_week(s.id, t - 7, t)->>'sales')::int), 0))
    into w from public.sites s where s.user_id = u.user_id and s.status = 'en_ligne';
    insert into public.weekly_sent (user_id, sent_at) values (u.user_id, now())
    on conflict (user_id) do update set sent_at = now();
    if (w->>'visits')::int = 0 and (w->>'res')::int = 0 and (w->>'orders')::int = 0 then continue; end if;
    txt := (w->>'visits') || ' visites, ' || (w->>'res') || ' réservations'
        || case when (w->>'orders')::int > 0 then ', ' || (w->>'orders') || ' commandes (' || round((w->>'sales')::int / 100.0) || ' €)' else '' end || '.';
    return query select p.endpoint, p.p256dh, p.auth, txt from public.push_subscriptions p where p.user_id = u.user_id;
  end loop;
end;
$$;
revoke all on function public.weekly_due(text) from public;
grant execute on function public.weekly_due(text) to anon, authenticated;
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique
);
create table if not exists public.referrals (
  referred uuid primary key references auth.users (id) on delete cascade,
  referrer uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on table public.referral_codes from anon, authenticated;
revoke all on table public.referrals from anon, authenticated;
create or replace function public.my_referral()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'connexion'; end if;
  select code into c from public.referral_codes where user_id = auth.uid();
  while c is null loop
    begin
      c := upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '01', ''), 1, 6));
      if length(c) < 6 then c := null; continue; end if;
      insert into public.referral_codes (user_id, code) values (auth.uid(), c);
    exception when unique_violation then c := null;
    end;
  end loop;
  return jsonb_build_object('code', c,
    'joined', (select count(*) from public.referrals where referrer = auth.uid()),
    'active', (select count(*) from public.referrals r where r.referrer = auth.uid()
                 and exists (select 1 from public.sites s where s.user_id = r.referred and s.status = 'en_ligne')));
end;
$$;
revoke all on function public.my_referral() from public;
grant execute on function public.my_referral() to authenticated;
create or replace function public.claim_referral(p_code text)
returns text language plpgsql security definer set search_path = public
as $$
declare ref uuid; me record;
begin
  select id, email, created_at into me from auth.users where id = auth.uid();
  if me.id is null then return 'connexion'; end if;
  select user_id into ref from public.referral_codes where code = upper(trim(p_code));
  if ref is null then return 'inconnu'; end if;
  if ref = me.id or public.norm_email((select email from auth.users where id = ref)) = public.norm_email(me.email) then return 'soi'; end if;
  if exists (select 1 from public.referrals where referred = me.id) then return 'deja'; end if;
  if me.created_at < now() - interval '3 days' then return 'ancien'; end if;
  insert into public.referrals (referred, referrer) values (me.id, ref);
  return 'ok';
end;
$$;
revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;
alter table public.reservations add column if not exists event_id text not null default '';
create or replace function public.book_event(p_slug text, p_event text, p_name text, p_phone text, p_people int, p_message text)
returns int language plpgsql security definer set search_path = public
as $$
declare sid uuid; ev jsonb; seats int; taken int;
begin
  select s.id, e into sid, ev from public.sites s, jsonb_array_elements(coalesce(s.published_content -> 'events', '[]')) e
  where s.slug = p_slug and s.status = 'en_ligne' and e ->> 'id' = p_event limit 1;
  if sid is null then raise exception 'evenement_introuvable'; end if;
  if (ev ->> 'date')::date < (now() at time zone 'Europe/Paris')::date then raise exception 'evenement_passe'; end if;
  if length(trim(p_name)) not between 1 and 80 or length(trim(p_phone)) not between 6 and 30 or p_people not between 1 and 20 then
    raise exception 'reservation_invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('event:' || sid::text || p_event));
  seats := greatest(coalesce((ev ->> 'seats')::int, 0), 0);
  select coalesce(sum(people), 0) into taken from public.reservations
  where site_id = sid and kind = 'evenement' and event_id = p_event and status <> 'refusee';
  if seats > 0 and taken + p_people > seats then raise exception 'complet:%', seats - taken; end if;
  if (select count(*) from public.reservations r where r.site_id = sid and r.created_at > now() - interval '1 day') >= 80 then
    raise exception 'reservation_trop';
  end if;
  insert into public.reservations (site_id, name, phone, day, time, people, message, kind, service, event_id)
  values (sid, trim(p_name), trim(p_phone), (ev ->> 'date')::date, coalesce(nullif(ev ->> 'time', ''), '19:00'), p_people,
          left(coalesce(p_message, ''), 300), 'evenement', left(ev ->> 'title', 80), p_event);
  return case when seats > 0 then seats - taken - p_people else -1 end;
end;
$$;
revoke all on function public.book_event(text, text, text, text, int, text) from public;
grant execute on function public.book_event(text, text, text, text, int, text) to anon, authenticated;
create or replace function public.event_seats(p_slug text)
returns table (event_id text, taken int)
language sql stable security definer set search_path = public
as $$
  select r.event_id, sum(r.people)::int from public.reservations r join public.sites s on s.id = r.site_id
  where s.slug = p_slug and s.status = 'en_ligne' and r.kind = 'evenement' and r.status <> 'refusee' group by r.event_id;
$$;
revoke all on function public.event_seats(text) from public;
grant execute on function public.event_seats(text) to anon, authenticated;
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  job text not null default '',
  name text not null,
  phone text not null default '',
  email text not null default '',
  message text not null default '',
  cv text not null default '',
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists job_applications_site_idx on public.job_applications (site_id, created_at desc);
alter table public.job_applications enable row level security;
drop policy if exists "jobs_owner_select" on public.job_applications;
create policy "jobs_owner_select" on public.job_applications for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "jobs_owner_update" on public.job_applications;
create policy "jobs_owner_update" on public.job_applications for update to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "jobs_owner_delete" on public.job_applications;
create policy "jobs_owner_delete" on public.job_applications for delete to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
revoke all on table public.job_applications from anon;
grant select, update, delete on table public.job_applications to authenticated;
create or replace function public.apply_job(p_slug text, p_job text, p_name text, p_phone text, p_email text, p_message text, p_cv text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare sid uuid;
begin
  select s.id into sid from public.sites s
  where s.slug = p_slug and s.status = 'en_ligne' and coalesce((s.published_content -> 'jobs' ->> 'enabled')::boolean, false) limit 1;
  if sid is null then raise exception 'recrutement_ferme'; end if;
  if length(trim(p_name)) not between 1 and 80 or (length(trim(coalesce(p_phone, ''))) < 6 and coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
     or length(coalesce(p_message, '')) > 1500 or length(coalesce(p_email, '')) > 120 or length(coalesce(p_phone, '')) > 30 then
    raise exception 'candidature_invalide';
  end if;
  if coalesce(p_cv, '') <> '' and p_cv !~ ('^' || p_slug || '/[A-Za-z0-9._-]{1,80}$') then raise exception 'candidature_invalide'; end if;
  if (select count(*) from public.job_applications j where j.site_id = sid and j.created_at > now() - interval '1 day') >= 30 then
    raise exception 'candidature_trop';
  end if;
  insert into public.job_applications (site_id, job, name, phone, email, message, cv)
  values (sid, left(coalesce(p_job, ''), 80), trim(p_name), trim(coalesce(p_phone, '')), trim(coalesce(p_email, '')), coalesce(p_message, ''), coalesce(p_cv, ''));
  return true;
end;
$$;
revoke all on function public.apply_job(text, text, text, text, text, text, text) from public;
grant execute on function public.apply_job(text, text, text, text, text, text, text) to anon, authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv', 'cv', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "cv_insert_visitor" on storage.objects;
create policy "cv_insert_visitor" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'cv' and (storage.foldername(name))[1] in (
    select s.slug from public.sites s where s.status = 'en_ligne' and coalesce((s.published_content -> 'jobs' ->> 'enabled')::boolean, false)));
drop policy if exists "cv_select_owner" on storage.objects;
create policy "cv_select_owner" on storage.objects for select to authenticated
  using (bucket_id = 'cv' and (storage.foldername(name))[1] in (select s.slug from public.sites s where s.user_id = auth.uid()));
drop policy if exists "cv_delete_owner" on storage.objects;
create policy "cv_delete_owner" on storage.objects for delete to authenticated
  using (bucket_id = 'cv' and (storage.foldername(name))[1] in (select s.slug from public.sites s where s.user_id = auth.uid()));
alter table public.subscribers enable row level security;
drop policy if exists "subscribers_owner_select" on public.subscribers;
create policy "subscribers_owner_select" on public.subscribers for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "subscribers_owner_delete" on public.subscribers;
create policy "subscribers_owner_delete" on public.subscribers for delete to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
revoke all on table public.subscribers from anon;
grant select, delete on table public.subscribers to authenticated;
create or replace function public.subscribe(p_slug text, p_contact text)
returns text language plpgsql security definer set search_path = public
as $$
declare sid uuid; c text := lower(trim(coalesce(p_contact, ''))); k text;
begin
  select s.id into sid from public.sites s
  where s.slug = p_slug and s.status = 'en_ligne' and coalesce((s.published_content -> 'newsletter' ->> 'enabled')::boolean, false) limit 1;
  if sid is null then raise exception 'newsletter_fermee'; end if;
  if c ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(c) <= 120 then k := 'email';
  else
    c := regexp_replace(c, '[^0-9+]', '', 'g');
    if c ~ '^0[67][0-9]{8}$' then c := '+33' || substr(c, 2); end if;
    if c !~ '^\+?[0-9]{8,15}$' then raise exception 'contact_invalide'; end if;
    k := 'sms';
  end if;
  if (select count(*) from public.subscribers x where x.site_id = sid and x.created_at > now() - interval '1 day') >= 200 then
    raise exception 'newsletter_trop';
  end if;
  insert into public.subscribers (site_id, contact, kind) values (sid, c, k) on conflict (site_id, contact) do nothing;
  return k;
end;
$$;
revoke all on function public.subscribe(text, text) from public;
grant execute on function public.subscribe(text, text) to anon, authenticated;
create table if not exists public.domain_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.sites (id) on delete cascade,
  domain text not null unique,
  status text not null default 'demande' check (status in ('demande', 'actif', 'refuse')),
  created_at timestamptz not null default now()
);
alter table public.domain_requests enable row level security;
drop policy if exists "domains_owner_select" on public.domain_requests;
create policy "domains_owner_select" on public.domain_requests for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
revoke all on table public.domain_requests from anon;
grant select on table public.domain_requests to authenticated;
create or replace function public.domain_request(p_site uuid, p_domain text)
returns text language plpgsql security definer set search_path = public
as $$
declare d text := lower(regexp_replace(trim(coalesce(p_domain, '')), '^(https?://)?(www\.)?', ''));
begin
  d := regexp_replace(d, '/.*$', '');
  if not exists (select 1 from public.sites where id = p_site and user_id = auth.uid()) then raise exception 'site_introuvable'; end if;
  if d !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,12}$' or d ~ '(vercel\.app|siteclic)' then
    raise exception 'domaine_invalide';
  end if;
  if exists (select 1 from public.domain_requests where domain = d and site_id <> p_site) then raise exception 'domaine_pris'; end if;
  if exists (select 1 from public.domain_requests where site_id = p_site and status = 'actif') then raise exception 'domaine_actif'; end if;
  insert into public.domain_requests (site_id, domain) values (p_site, d)
  on conflict (site_id) do update set domain = excluded.domain, status = 'demande', created_at = now();
  return d;
end;
$$;
revoke all on function public.domain_request(uuid, text) from public;
grant execute on function public.domain_request(uuid, text) to authenticated;
create or replace function public.domain_list()
returns table (id uuid, domain text, status text, created_at timestamptz, site_name text, slug text, email text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_team_session() then raise exception 'reserve_proprietaire'; end if;
  return query select d.id, d.domain, d.status, d.created_at, s.name, s.slug, u.email::text
    from public.domain_requests d join public.sites s on s.id = d.site_id join auth.users u on u.id = s.user_id
    order by (d.status = 'demande') desc, d.created_at desc limit 100;
end;
$$;
revoke all on function public.domain_list() from public;
grant execute on function public.domain_list() to authenticated;
create or replace function public.domain_set_status(p_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_team_session() then raise exception 'reserve_proprietaire'; end if;
  if p_status not in ('demande', 'actif', 'refuse') then raise exception 'statut_invalide'; end if;
  update public.domain_requests set status = p_status where id = p_id;
  return found;
end;
$$;
revoke all on function public.domain_set_status(uuid, text) from public;
grant execute on function public.domain_set_status(uuid, text) to authenticated;
create or replace function public.domain_slug(p_host text)
returns text language sql stable security definer set search_path = public
as $$
  select s.slug from public.domain_requests d join public.sites s on s.id = d.site_id
  where d.domain = regexp_replace(lower(coalesce(p_host, '')), '^www\.', '') and d.status = 'actif' and s.status = 'en_ligne' limit 1;
$$;
revoke all on function public.domain_slug(text) from public;
grant execute on function public.domain_slug(text) to anon, authenticated;
