-- Réservations de table depuis les sites des clients. À coller une seule fois dans Supabase > SQL Editor, puis « Run ».

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites on delete cascade,
  name text not null,
  phone text not null,
  day date not null,
  time text not null,
  people int not null,
  message text not null default '',
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reservations_site_idx on public.reservations (site_id, created_at desc);
alter table public.reservations enable row level security;

-- Le commerçant voit et gère les demandes de ses propres sites.
drop policy if exists "reservations_owner_select" on public.reservations;
create policy "reservations_owner_select" on public.reservations for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "reservations_owner_update" on public.reservations;
create policy "reservations_owner_update" on public.reservations for update to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
drop policy if exists "reservations_owner_delete" on public.reservations;
create policy "reservations_owner_delete" on public.reservations for delete to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
revoke all on table public.reservations from anon;
grant select, update, delete on table public.reservations to authenticated;

-- Les visiteurs envoient une demande uniquement par cette fonction (vérifications + 40 demandes par jour et par site au maximum).
create or replace function public.request_reservation(
  p_slug text, p_name text, p_phone text, p_day date, p_time text, p_people int, p_message text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  sid uuid;
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
  if (select count(*) from public.reservations r where r.site_id = sid and r.created_at > now() - interval '1 day') >= 40 then
    raise exception 'reservation_trop';
  end if;
  insert into public.reservations (site_id, name, phone, day, time, people, message)
  values (sid, trim(p_name), trim(p_phone), p_day, p_time, p_people, coalesce(trim(p_message), ''));
  return true;
end;
$$;
revoke all on function public.request_reservation(text, text, text, date, text, int, text) from public;
grant execute on function public.request_reservation(text, text, text, date, text, int, text) to anon, authenticated;
