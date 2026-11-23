-- Table des sites créés par les clients SiteClic.
-- À coller une seule fois dans Supabase > SQL Editor, puis « Run ».

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  trade text,
  brief jsonb,
  content jsonb not null,
  status text not null default 'apercu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sites enable row level security;

-- Les nouveaux projets Supabase ne donnent plus ces droits automatiquement.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.sites to authenticated;

-- Chaque client ne voit et ne modifie que ses propres sites.
drop policy if exists "sites_select_own" on public.sites;
create policy "sites_select_own" on public.sites for select using (auth.uid() = user_id);
drop policy if exists "sites_insert_own" on public.sites;
create policy "sites_insert_own" on public.sites for insert with check (auth.uid() = user_id);
drop policy if exists "sites_update_own" on public.sites;
create policy "sites_update_own" on public.sites for update using (auth.uid() = user_id);
drop policy if exists "sites_delete_own" on public.sites;
create policy "sites_delete_own" on public.sites for delete using (auth.uid() = user_id);

create index if not exists sites_user_id_idx on public.sites (user_id);

-- Étape 5 (mise en ligne) : voir 02-mise-en-ligne.sql
