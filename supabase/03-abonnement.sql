-- Étape 6 : abonnement. À coller une seule fois dans Supabase > SQL Editor, puis « Run ».

alter table public.sites add column if not exists billing_customer text;

drop function if exists public.get_published_site(text);
create function public.get_published_site(p_slug text)
returns table (name text, content jsonb, published_at timestamptz, user_id uuid, billing_customer text)
language sql stable security definer set search_path = public
as $$
  select s.name, s.published_content, s.published_at, s.user_id, s.billing_customer
  from public.sites s
  where s.slug = p_slug and s.status = 'en_ligne' and s.published_content is not null
  limit 1;
$$;

revoke all on function public.get_published_site(text) from public;
grant execute on function public.get_published_site(text) to anon, authenticated;
