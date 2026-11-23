-- Étape 5 : mise en ligne des sites.
-- À coller une seule fois dans Supabase > SQL Editor, puis « Run ».

alter table public.sites add column if not exists slug text;
alter table public.sites add column if not exists published_content jsonb;
alter table public.sites add column if not exists published_at timestamptz;
create unique index if not exists sites_slug_key on public.sites (slug);

-- Les visiteurs ne voient QUE la version publiée d'un site en ligne (rien d'autre de la table).
create or replace function public.get_published_site(p_slug text)
returns table (name text, content jsonb, published_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.published_content, s.published_at
  from public.sites s
  where s.slug = p_slug and s.status = 'en_ligne' and s.published_content is not null
  limit 1;
$$;

revoke all on function public.get_published_site(text) from public;
grant execute on function public.get_published_site(text) to anon, authenticated;
