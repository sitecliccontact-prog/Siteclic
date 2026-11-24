-- Assistant IA des sites + tableau des réservations. À coller une seule fois dans Supabase > SQL Editor, puis « Run ».

-- 1. Statut des réservations (nouvelle, confirmée, refusée)
alter table public.reservations add column if not exists status text not null default 'nouvelle';
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check check (status in ('nouvelle', 'confirmee', 'refusee'));

-- 2. Compteur de l'assistant (protège le crédit IA) : 200 messages par site et 30 par visiteur, par jour
create table if not exists public.assistant_usage (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  visitor text not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_usage_idx on public.assistant_usage (slug, created_at);
alter table public.assistant_usage enable row level security;
revoke all on table public.assistant_usage from anon, authenticated;

create or replace function public.assistant_hit(p_slug text, p_visitor text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('assistant:' || p_slug));
  if (select count(*) from public.assistant_usage where slug = p_slug and created_at > now() - interval '1 day') >= 200 then
    return false;
  end if;
  if (select count(*) from public.assistant_usage where slug = p_slug and visitor = p_visitor and created_at > now() - interval '1 day') >= 30 then
    return false;
  end if;
  insert into public.assistant_usage (slug, visitor) values (left(p_slug, 80), left(p_visitor, 80));
  delete from public.assistant_usage where created_at < now() - interval '3 days';
  return true;
end;
$$;
revoke all on function public.assistant_hit(text, text) from public;
grant execute on function public.assistant_hit(text, text) to anon, authenticated;
