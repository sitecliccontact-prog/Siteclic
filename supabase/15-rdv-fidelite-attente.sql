-- SiteClic : rendez-vous (coiffeurs, instituts), liste d'attente, carte de fidélité (26/11/2026).
-- À exécuter une fois dans Supabase > SQL Editor, puis « Run ».

-- 1) Réservations : rendez-vous et liste d'attente.
alter table public.reservations add column if not exists kind text not null default 'table';  -- table, rdv
alter table public.reservations add column if not exists service text not null default '';
alter table public.reservations add column if not exists duration int not null default 0;     -- minutes (rendez-vous)
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check check (status in ('nouvelle', 'confirmee', 'refusee', 'attente'));

-- Prise de rendez-vous depuis le site (le créneau est revérifié ici : pas de double rendez-vous pour la même personne de l'équipe).
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
  -- Pris si la personne choisie est occupée, ou si toute l'équipe est occupée sur ce créneau.
  if (st <> '' and busy > 0) or total >= team then raise exception 'creneau_pris'; end if;
  insert into public.reservations (site_id, name, phone, day, time, people, message, table_label, kind, service, duration)
  values (sid, trim(p_name), trim(p_phone), p_day, p_time, 1, coalesce(trim(p_message), ''), st, 'rdv', left(trim(coalesce(p_service, '')), 60), p_minutes);
  return true;
end;
$$;
revoke all on function public.book_appointment(text, text, text, date, text, text, text, int, text) from public;
grant execute on function public.book_appointment(text, text, text, date, text, text, text, int, text) to anon, authenticated;

-- Créneaux déjà pris un jour donné (sans nom ni téléphone).
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

-- Liste d'attente : le restaurant est complet, le client laisse son numéro.
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

-- 2) Carte de fidélité : les tampons sont gardés ici (impossible de les inventer), le téléphone du client garde juste son numéro de carte.
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

-- Code du jour à 4 chiffres (change chaque jour), montré au commerçant dans son appli.
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

-- Nombre de tampons d'une carte (non utilisés).
create or replace function public.loyalty_count(p_slug text, p_card uuid)
returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from public.loyalty_stamps l join public.sites s on s.id = l.site_id
      where s.slug = p_slug and l.card = p_card and l.redeemed_at is null $$;
revoke all on function public.loyalty_count(text, uuid) from public;
grant execute on function public.loyalty_count(text, uuid) to anon, authenticated;

-- Tamponner (p_redeem = false) ou utiliser la récompense (p_redeem = true), avec le code du jour donné par le commerçant.
-- Renvoie le nombre de tampons après l'opération, ou une erreur : -1 code faux, -2 trop d'essais, -3 déjà tamponné aujourd'hui, -4 pas assez de tampons.
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
