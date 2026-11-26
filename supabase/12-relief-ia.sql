-- SiteClic : reliefs créés par l'IA (1 € = 5 créations). À exécuter une fois dans Supabase > SQL Editor.
create table if not exists public.relief_usage (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists relief_usage_user_idx on public.relief_usage (user_id);
alter table public.relief_usage enable row level security;

-- Nombre de créations déjà faites par ce compte.
create or replace function public.relief_count()
returns int language sql stable security definer set search_path = public
as $$ select count(*)::int from public.relief_usage where user_id = auth.uid() $$;

-- Note une création (impossible à effacer côté client).
create or replace function public.relief_use()
returns int language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return -1; end if;
  insert into public.relief_usage (user_id) values (auth.uid());
  return (select count(*)::int from public.relief_usage where user_id = auth.uid());
end;
$$;
revoke all on function public.relief_count() from public;
revoke all on function public.relief_use() from public;
grant execute on function public.relief_count() to authenticated;
grant execute on function public.relief_use() to authenticated;
