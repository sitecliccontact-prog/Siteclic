-- Limites d'utilisation de l'IA (protège le crédit IA). À coller une seule fois dans Supabase > SQL Editor, puis « Run ».
-- Chaque utilisation est notée ici. Les clients ne peuvent ni lire, ni modifier, ni effacer ce compteur :
-- supprimer un site ne redonne donc pas d'essais gratuits.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('creation', 'import', 'modification')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, kind, created_at);
alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;

-- Compte les utilisations (création et import comptent ensemble).
create or replace function public.ai_use_counts(p_kind text)
returns table (total int, last_day int, last_month int)
language sql stable security definer set search_path = public
as $$
  select count(*)::int,
         (count(*) filter (where u.created_at > now() - interval '1 day'))::int,
         (count(*) filter (where u.created_at > now() - interval '30 days'))::int
  from public.ai_usage u
  where u.user_id = auth.uid()
    and (u.kind = p_kind or (p_kind in ('creation', 'import') and u.kind in ('creation', 'import')));
$$;

-- Note une utilisation puis renvoie les compteurs (une demande à la fois par compte).
create or replace function public.record_ai_use(p_kind text)
returns table (total int, last_day int, last_month int)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'non connecté';
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  insert into public.ai_usage (user_id, kind) values (auth.uid(), p_kind);
  return query select * from public.ai_use_counts(p_kind);
end;
$$;

revoke all on function public.ai_use_counts(text) from public;
revoke all on function public.record_ai_use(text) from public;
grant execute on function public.ai_use_counts(text) to authenticated;
grant execute on function public.record_ai_use(text) to authenticated;
