-- SiteClic : statistiques de visites, commandes à emporter, cartes cadeaux (26/11/2026).
-- À exécuter une fois dans Supabase > SQL Editor.

-- 1) Statistiques : visites par jour et par site (aucune donnée personnelle).
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

-- 2) Commandes à emporter.
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

-- Repère du paiement Stripe (l'état réel est toujours relu chez Stripe).
create or replace function public.attach_order_payment(p_order uuid, p_session text)
returns void language sql security definer set search_path = public
as $$ update public.orders set pay_session = p_session
      where id = p_order and pay_session is null and created_at > now() - interval '15 minutes' and p_session ~ '^cs_[A-Za-z0-9_]{10,200}$' $$;
revoke all on function public.attach_order_payment(uuid, text) from public;
grant execute on function public.attach_order_payment(uuid, text) to anon, authenticated;

-- 3) Cartes cadeaux.
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

-- Page de remerciement : retrouver la carte d'un paiement (le serveur vérifie le paiement chez Stripe avant de l'afficher).
create or replace function public.gift_by_session(p_session text)
returns table (code text, amount int, recipient text, message text, site_name text)
language sql stable security definer set search_path = public
as $$ select g.code, g.amount, g.recipient, g.message, s.name from public.gift_cards g join public.sites s on s.id = g.site_id
      where g.pay_session = p_session and p_session ~ '^cs_[A-Za-z0-9_]{10,200}$' $$;
revoke all on function public.gift_by_session(text) from public;
grant execute on function public.gift_by_session(text) to anon, authenticated;
