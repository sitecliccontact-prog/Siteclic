-- SiteClic : plan de salle (choisir sa table) + agenda (les réservations dans Google Agenda / iPhone).
-- À exécuter une fois dans Supabase > SQL Editor.

alter table public.reservations add column if not exists table_label text not null default '';
alter table public.sites add column if not exists agenda_token uuid default gen_random_uuid();
update public.sites set agenda_token = gen_random_uuid() where agenda_token is null;
create unique index if not exists sites_agenda_token_idx on public.sites (agenda_token);

-- Réservation avec table choisie (refuse une table déjà prise dans les 2 heures).
create or replace function public.book_table(
  p_slug text, p_name text, p_phone text, p_day date, p_time text, p_people int, p_message text, p_table text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid;
  t text := left(trim(coalesce(p_table, '')), 40);
begin
  select s.id into sid from public.sites s
  where s.slug = p_slug and s.status = 'en_ligne' and s.published_content is not null
    and coalesce((s.published_content -> 'booking' ->> 'enabled')::boolean,
                 (s.published_content -> 'hero' ->> 'cta') ~* 'r[ée]serv')
  limit 1;
  if sid is null then raise exception 'reservation_indisponible'; end if;
  if length(trim(p_name)) not between 1 and 80 or length(trim(p_phone)) not between 6 and 30
     or p_people not between 1 and 30 or p_day < current_date or p_day > current_date + 365
     or p_time !~ '^[0-2][0-9]:[0-5][0-9]$' or length(coalesce(p_message, '')) > 500 then
    raise exception 'reservation_invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('table:' || sid::text));
  if (select count(*) from public.reservations r where r.site_id = sid and r.created_at > now() - interval '1 day') >= 40 then
    raise exception 'reservation_trop';
  end if;
  if t <> '' and exists (
    select 1 from public.reservations r
    where r.site_id = sid and r.day = p_day and r.table_label = t and r.status <> 'refusee'
      and abs(extract(epoch from (r.time::time - p_time::time))) < 7200
  ) then
    raise exception 'table_prise';
  end if;
  insert into public.reservations (site_id, name, phone, day, time, people, message, table_label)
  values (sid, trim(p_name), trim(p_phone), p_day, p_time, p_people, coalesce(trim(p_message), ''), t);
  return true;
end;
$$;
revoke all on function public.book_table(text, text, text, date, text, int, text, text) from public;
grant execute on function public.book_table(text, text, text, date, text, int, text, text) to anon, authenticated;

-- Tables déjà prises un jour donné (sans nom ni téléphone : rien de personnel).
create or replace function public.booking_load(p_slug text, p_day date)
returns table (at_time text, people int, table_label text)
language sql stable security definer set search_path = public
as $$
  select r.time, r.people, r.table_label
  from public.reservations r join public.sites s on s.id = r.site_id
  where s.slug = p_slug and s.status = 'en_ligne' and r.day = p_day and r.status <> 'refusee'
  order by r.time;
$$;
revoke all on function public.booking_load(text, date) from public;
grant execute on function public.booking_load(text, date) to anon, authenticated;

-- Agenda privé du commerçant (lien secret à ajouter dans Google Agenda ou sur iPhone).
create or replace function public.agenda_feed(p_token uuid)
returns table (site_name text, id uuid, day date, at_time text, people int, name text, phone text, message text, status text, table_label text)
language sql stable security definer set search_path = public
as $$
  select s.name, r.id, r.day, r.time, r.people, r.name, r.phone, r.message, r.status, r.table_label
  from public.sites s join public.reservations r on r.site_id = s.id
  where s.agenda_token = p_token and r.day >= current_date - 30 and r.status <> 'refusee'
  order by r.day, r.time
  limit 500;
$$;
revoke all on function public.agenda_feed(uuid) from public;
grant execute on function public.agenda_feed(uuid) to anon, authenticated;
