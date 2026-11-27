-- SiteClic : 8 options en plus (27/11/2026) : notifications, rapport du lundi, parrainage, événements,
-- offres d'emploi, newsletter / SMS, nom de domaine. (Les allergènes n'ont besoin de rien ici.)
-- À exécuter une fois dans Supabase > SQL Editor, puis « Run ».

-- 0) Clé du serveur SiteClic : seul le serveur peut envoyer les notifications (son empreinte est enregistrée
--    automatiquement quand le propriétaire ouvre son tableau de bord).
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

-- 1) Notifications sur le téléphone du commerçant (nouvelle réservation, commande, candidature…).
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
  -- 5 téléphones au maximum par compte.
  delete from public.push_subscriptions where user_id = auth.uid() and endpoint not in (
    select endpoint from public.push_subscriptions where user_id = auth.uid() order by created_at desc limit 5);
  return true;
end;
$$;
revoke all on function public.push_save(text, text, text) from public;
grant execute on function public.push_save(text, text, text) to authenticated;

-- Le serveur récupère les téléphones du commerçant d'un site (avec sa clé uniquement).
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

-- 2) Rapport de la semaine (visites, réservations, commandes, avis) : affiché dans l'appli et envoyé le lundi matin.
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

-- Les 7 derniers jours de chaque site du commerçant, comparés aux 7 jours d'avant.
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

-- Le lundi : chaque commerçant (avec notifications) reçoit son résumé une seule fois par semaine.
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

-- 3) Parrainage : un commerçant qui fait venir un autre commerçant gagne 1 mois d'hébergement.
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

-- 4) Événements et soirées : places limitées, la réservation est revérifiée ici (pas de surbooking).
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

-- 5) Offres d'emploi : candidatures (CV en option, dans un dossier privé « cv/<adresse du site>/ » que seul le commerçant peut lire).
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

-- 6) Newsletter / SMS : les clients laissent leur e-mail ou leur téléphone sur le site (avec leur accord).
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

-- 7) Nom de domaine : le commerçant demande son adresse (ex. monresto.fr), SiteClic l'achète et la branche.
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

-- Pour le propriétaire (page « Mes statistiques ») : les demandes à traiter.
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

-- Quel site afficher pour une adresse (ex. monresto.fr) ? Information publique.
create or replace function public.domain_slug(p_host text)
returns text language sql stable security definer set search_path = public
as $$
  select s.slug from public.domain_requests d join public.sites s on s.id = d.site_id
  where d.domain = regexp_replace(lower(coalesce(p_host, '')), '^www\.', '') and d.status = 'actif' and s.status = 'en_ligne' limit 1;
$$;
revoke all on function public.domain_slug(text) from public;
grant execute on function public.domain_slug(text) to anon, authenticated;
