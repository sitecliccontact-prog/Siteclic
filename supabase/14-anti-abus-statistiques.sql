-- SiteClic : anti-abus de l'essai gratuit, une connexion par compte (2 appareils max), statistiques du propriétaire (26/11/2026).
-- À exécuter une fois dans Supabase > SQL Editor, puis « Run ».

-- 0) Compte propriétaire SiteClic (siteclic.contact ou siteclic.contact+quelquechose @gmail.com, e-mail confirmé).
create or replace function public.is_team_session()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') ~* '^siteclic\.contact(\+[^@]*)?@gmail\.com$', false)
     and exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function public.is_team_session() from public;
grant execute on function public.is_team_session() to authenticated;

-- 1) Réglages (modifiables seulement par le propriétaire, depuis « Mes statistiques »).
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  free_trial boolean not null default true,      -- essai gratuit ouvert
  free_budget_cents int not null default 300,    -- dépense IA gratuite max par jour (tous comptes gratuits)
  free_publish boolean not null default false,   -- mise en ligne gratuite en attendant Stripe
  max_per_ip_day int not null default 3          -- comptes gratuits max par connexion Internet et par jour
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;

create or replace function public.app_settings_get()
returns table (free_trial boolean, free_budget_cents int, free_publish boolean, max_per_ip_day int)
language sql stable security definer set search_path = public
as $$ select a.free_trial, a.free_budget_cents, a.free_publish, a.max_per_ip_day from public.app_settings a where a.id = 1 $$;
revoke all on function public.app_settings_get() from public;
grant execute on function public.app_settings_get() to anon, authenticated;

create or replace function public.app_settings_set(p_free_trial boolean, p_budget int, p_free_publish boolean, p_ip_max int)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_team_session() then raise exception 'reserve_proprietaire'; end if;
  update public.app_settings set free_trial = p_free_trial, free_budget_cents = greatest(0, least(p_budget, 100000)),
    free_publish = p_free_publish, max_per_ip_day = greatest(1, least(p_ip_max, 50)) where id = 1;
end;
$$;
revoke all on function public.app_settings_set(boolean, int, boolean, int) from public;
grant execute on function public.app_settings_set(boolean, int, boolean, int) to authenticated;

-- 2) Essai gratuit : une seule fois par personne (e-mail sans les alias, appareil, connexion Internet).
alter table public.ai_usage add column if not exists free boolean not null default false;
alter table public.ai_usage add column if not exists cost_cents int not null default 0;

create table if not exists public.free_claims (
  user_id uuid primary key references auth.users on delete cascade,
  norm_email text not null unique,
  device text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists free_claims_device_idx on public.free_claims (device);
create index if not exists free_claims_ip_idx on public.free_claims (ip, created_at);
alter table public.free_claims enable row level security;
revoke all on table public.free_claims from anon, authenticated;

create table if not exists public.abuse_log (
  id bigserial primary key,
  user_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists abuse_log_time_idx on public.abuse_log (created_at);
alter table public.abuse_log enable row level security;
revoke all on table public.abuse_log from anon, authenticated;

-- jean.dupont+essai2@gmail.com, jeandupont@googlemail.com… = la même personne.
create or replace function public.norm_email(p text)
returns text language sql immutable
as $$
  select case when d in ('gmail.com', 'googlemail.com') then replace(l, '.', '') || '@gmail.com' else l || '@' || d end
  from (select split_part(split_part(lower(trim(p)), '@', 1), '+', 1) as l, split_part(lower(trim(p)), '@', 2) as d) x
$$;

-- Appelée par le serveur juste avant chaque utilisation de l'IA par un compte gratuit.
-- verdict : ok, confirmer, essai_ferme, deja_utilise, appareil, internet, budget, limite.
create or replace function public.free_ai_gate(p_kind text, p_limit int, p_device text, p_ip text)
returns table (verdict text, total int, last_day int, last_month int)
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.app_settings;
  em text;
  ne text;
  dev text := case when p_device ~ '^[A-Za-z0-9_-]{16,64}$' then p_device end;
  ipa text := left(nullif(trim(p_ip), ''), 64);
  c record;
  cost int := case when p_kind = 'modification' then 5 else 25 end;
  v text := null;
begin
  if uid is null then raise exception 'non connecté'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select * into s from public.app_settings where id = 1;
  select u.email into em from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  select * into c from public.ai_use_counts(p_kind);

  if em is null then v := 'confirmer';
  elsif not s.free_trial then v := 'essai_ferme';
  elsif c.total >= p_limit then v := 'limite';
  else
    ne := public.norm_email(em);
    if exists (select 1 from public.free_claims f where f.norm_email = ne and f.user_id <> uid) then v := 'deja_utilise';
    elsif not exists (select 1 from public.free_claims f where f.user_id = uid) then
      if dev is not null and exists (select 1 from public.free_claims f where f.device = dev and f.user_id <> uid) then v := 'appareil';
      elsif ipa is not null and (select count(*) from public.free_claims f where f.ip = ipa and f.created_at > now() - interval '1 day') >= s.max_per_ip_day then v := 'internet';
      else insert into public.free_claims (user_id, norm_email, device, ip) values (uid, ne, dev, ipa);
      end if;
    end if;
    if v is null and (select coalesce(sum(a.cost_cents), 0) from public.ai_usage a
                      where a.free and a.created_at >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris') + cost > s.free_budget_cents then
      v := 'budget';
    end if;
  end if;

  if v is not null then
    if v <> 'limite' then insert into public.abuse_log (user_id, reason) values (uid, v); end if;
    return query select v, c.total, c.last_day, c.last_month;
    return;
  end if;
  insert into public.ai_usage (user_id, kind, free, cost_cents) values (uid, p_kind, true, cost);
  return query select 'ok'::text, x.total, x.last_day, x.last_month from public.ai_use_counts(p_kind) x;
end;
$$;
revoke all on function public.free_ai_gate(text, int, text, text) from public;
grant execute on function public.free_ai_gate(text, int, text, text) to authenticated;

-- 3) Un compte = 2 appareils connectés au maximum (une 3e connexion déconnecte la plus ancienne).
create table if not exists public.user_sessions (
  user_id uuid primary key references auth.users on delete cascade,
  sids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.user_sessions enable row level security;
revoke all on table public.user_sessions from anon, authenticated;

create or replace function public.claim_session()
returns void language plpgsql security definer set search_path = public
as $$
declare sid text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null or sid is null then return; end if;
  insert into public.user_sessions (user_id, sids) values (auth.uid(), array[sid])
  on conflict (user_id) do update set sids = (array[sid] || array_remove(public.user_sessions.sids, sid))[1:2], updated_at = now();
end;
$$;
revoke all on function public.claim_session() from public;
grant execute on function public.claim_session() to authenticated;

create or replace function public.session_ok()
returns boolean language plpgsql security definer set search_path = public
as $$
declare sid text := auth.jwt() ->> 'session_id'; r public.user_sessions;
begin
  if auth.uid() is null or sid is null or public.is_team_session() then return true; end if;
  select * into r from public.user_sessions where user_id = auth.uid();
  if r is null then perform public.claim_session(); return true; end if;
  return sid = any (r.sids);
end;
$$;
revoke all on function public.session_ok() from public;
grant execute on function public.session_ok() to authenticated;

-- 4) Statistiques du propriétaire (page « Mes statistiques »).
create or replace function public.owner_stats()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare since timestamptz := now() - interval '30 days'; today timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
begin
  if not public.is_team_session() then raise exception 'reserve_proprietaire'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users u where u.email !~* '^siteclic\.contact(\+[^@]*)?@gmail\.com$'),
    'confirmed', (select count(*) from auth.users u where u.email_confirmed_at is not null and u.email !~* '^siteclic\.contact(\+[^@]*)?@gmail\.com$'),
    'signups', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]') from (
        select (u.created_at at time zone 'Europe/Paris')::date d, count(*) n from auth.users u
        where u.created_at > since and u.email !~* '^siteclic\.contact(\+[^@]*)?@gmail\.com$' group by 1) x),
    'free_users', (select count(*) from public.free_claims),
    'sites', (select count(*) from public.sites),
    'online', (select count(*) from public.sites where status = 'en_ligne'),
    'sites_30', (select count(*) from public.sites where created_at > since),
    'ai', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'free', free, 'n', n)), '[]') from (
        select a.kind, a.free, count(*) n from public.ai_usage a where a.created_at > since group by 1, 2) x),
    'free_today_cents', (select coalesce(sum(cost_cents), 0) from public.ai_usage where free and created_at >= today),
    'free_30_cents', (select coalesce(sum(cost_cents), 0) from public.ai_usage where free and created_at > since),
    'abuse', (select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'n', n)), '[]') from (
        select reason, count(*) n from public.abuse_log where created_at > since group by 1) x),
    'reservations', (select count(*) from public.reservations where created_at > since)
  );
end;
$$;
revoke all on function public.owner_stats() from public;
grant execute on function public.owner_stats() to authenticated;
