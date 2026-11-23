-- Photos des clients (+ réglages de l'abonnement). À coller une seule fois dans Supabase > SQL Editor, puis « Run ».

-- 1. Dossier de photos (lisible par tous, chaque client n'écrit que dans son propre dossier)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos_insert_own" on storage.objects;
create policy "photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_select_own" on storage.objects;
create policy "photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_delete_own" on storage.objects;
create policy "photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Abonnement : un site en ligne est retiré si l'abonnement se termine
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
