-- SiteClic : vidéos de présentation + limites d'IA plus serrées (coût maîtrisé).
-- À exécuter une fois dans Supabase > SQL Editor.

-- 1) Dossier « videos » (public, 50 Mo max par vidéo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos_insert_own" on storage.objects;
create policy "videos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "videos_select_own" on storage.objects;
create policy "videos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "videos_delete_own" on storage.objects;
create policy "videos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) Assistant des sites : 40 questions par site et par jour, 15 par visiteur.
create or replace function public.assistant_hit(p_slug text, p_visitor text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('assistant:' || p_slug));
  if (select count(*) from public.assistant_usage where slug = p_slug and created_at > now() - interval '1 day') >= 40 then
    return false;
  end if;
  if (select count(*) from public.assistant_usage where slug = p_slug and visitor = p_visitor and created_at > now() - interval '1 day') >= 15 then
    return false;
  end if;
  insert into public.assistant_usage (slug, visitor) values (left(p_slug, 80), left(p_visitor, 80));
  delete from public.assistant_usage where created_at < now() - interval '3 days';
  return true;
end;
$$;
revoke all on function public.assistant_hit(text, text) from public;
grant execute on function public.assistant_hit(text, text) to anon, authenticated;

-- 3) Aide SiteClic : 10 questions par jour et par compte.
create or replace function public.aide_hit()
returns boolean
language plpgsql security definer set search_path = public
as $$
declare k text := 'aide:' || auth.uid()::text;
begin
  if auth.uid() is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(k));
  if (select count(*) from public.assistant_usage where slug = k and created_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into public.assistant_usage (slug, visitor) values (k, auth.uid()::text);
  return true;
end;
$$;
revoke all on function public.aide_hit() from public;
grant execute on function public.aide_hit() to authenticated;
