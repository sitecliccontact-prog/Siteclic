-- SiteClic : assistant IA de réservation = option payante par site (26/11/2026).
-- Essentiel : 300 conversations / mois. Pro : 1000 conversations / mois.
-- Sans option (ou limite atteinte), le site garde la réservation classique (formulaire + plan de salle).

-- 1) Option IA de chaque site (écrite seulement par SiteClic / Stripe, lisible par le propriétaire).
create table if not exists public.site_ai_plans (
  site_id uuid primary key references public.sites (id) on delete cascade,
  plan text not null check (plan in ('essentiel', 'pro')),
  active_until timestamptz,
  stripe_subscription text,
  updated_at timestamptz not null default now()
);
alter table public.site_ai_plans enable row level security;
drop policy if exists "site_ai_plans_owner_read" on public.site_ai_plans;
create policy "site_ai_plans_owner_read" on public.site_ai_plans for select
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));

-- 2) Conversations comptées par site et par mois.
create table if not exists public.assistant_convs (
  site_id uuid not null references public.sites (id) on delete cascade,
  conv text not null,
  visitor text not null default '',
  month date not null,
  messages int not null default 0,
  voix int not null default 0,
  created_at timestamptz not null default now(),
  primary key (site_id, conv)
);
create index if not exists assistant_convs_month_idx on public.assistant_convs (site_id, month);
alter table public.assistant_convs enable row level security;

-- 3) Nombre de conversations par mois pour un site (0 = pas d'option).
create or replace function public.ai_quota(p_site uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select case
    when exists (select 1 from public.sites s join auth.users u on u.id = s.user_id
                 where s.id = p_site and u.email ~* '^siteclic\.contact(\+[^@]*)?@gmail\.com$') then 100000
    else coalesce((select case p.plan when 'pro' then 1000 when 'essentiel' then 300 else 0 end
                   from public.site_ai_plans p
                   where p.site_id = p_site and (p.active_until is null or p.active_until > now())), 0)
  end;
$$;
revoke all on function public.ai_quota(uuid) from public;

create or replace function public.paris_month()
returns date language sql stable as $$ select date_trunc('month', now() at time zone 'Europe/Paris')::date $$;

-- 4) Le site a-t-il l'assistant IA disponible en ce moment ?
create or replace function public.assistant_status(p_slug text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare sid uuid; q int;
begin
  select id into sid from public.sites where slug = p_slug and status = 'en_ligne';
  if sid is null then return false; end if;
  q := public.ai_quota(sid);
  return q > 0 and (select count(*) from public.assistant_convs where site_id = sid and month = public.paris_month()) < q;
end;
$$;
revoke all on function public.assistant_status(text) from public;
grant execute on function public.assistant_status(text) to anon, authenticated;

-- 5) Compte une conversation (ou un message dans une conversation déjà ouverte).
--    Réponses : 'ok', 'off' (pas d'option), 'quota' (limite du mois atteinte), 'trop' (abus).
create or replace function public.assistant_conv(p_slug text, p_conv text, p_visitor text, p_kind text)
returns text
language plpgsql security definer set search_path = public
as $$
declare sid uuid; q int; m date := public.paris_month(); r public.assistant_convs;
begin
  if p_conv is null or length(p_conv) < 8 or length(p_conv) > 64 then return 'trop'; end if;
  select id into sid from public.sites where slug = p_slug and status = 'en_ligne';
  if sid is null then return 'off'; end if;
  q := public.ai_quota(sid);
  if q = 0 then return 'off'; end if;
  perform pg_advisory_xact_lock(hashtext('conv:' || sid::text));
  select * into r from public.assistant_convs where site_id = sid and conv = p_conv;
  if found then
    if p_kind = 'voix' then
      if r.voix >= 40 then return 'trop'; end if;
      update public.assistant_convs set voix = voix + 1 where site_id = sid and conv = p_conv;
    else
      if r.messages >= 24 then return 'trop'; end if;
      update public.assistant_convs set messages = messages + 1 where site_id = sid and conv = p_conv;
    end if;
    return 'ok';
  end if;
  if (select count(*) from public.assistant_convs where site_id = sid and month = m) >= q then return 'quota'; end if;
  if (select count(*) from public.assistant_convs where site_id = sid and visitor = left(p_visitor, 80)
      and created_at > now() - interval '1 day') >= 8 then return 'trop'; end if;
  insert into public.assistant_convs (site_id, conv, visitor, month, messages, voix)
  values (sid, p_conv, left(p_visitor, 80), m, case when p_kind = 'voix' then 0 else 1 end, case when p_kind = 'voix' then 1 else 0 end);
  return 'ok';
end;
$$;
revoke all on function public.assistant_conv(text, text, text, text) from public;
grant execute on function public.assistant_conv(text, text, text, text) to anon, authenticated;

-- 6) Pour l'éditeur : option et conversations utilisées ce mois-ci (propriétaire seulement).
create or replace function public.assistant_offer(p_site uuid)
returns table (plan text, quota int, used int, active_until timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.sites where id = p_site and user_id = auth.uid()) then return; end if;
  return query
    select (select p.plan from public.site_ai_plans p where p.site_id = p_site and (p.active_until is null or p.active_until > now())),
           public.ai_quota(p_site),
           (select count(*)::int from public.assistant_convs c where c.site_id = p_site and c.month = public.paris_month()),
           (select p.active_until from public.site_ai_plans p where p.site_id = p_site);
end;
$$;
revoke all on function public.assistant_offer(uuid) from public;
grant execute on function public.assistant_offer(uuid) to authenticated;
