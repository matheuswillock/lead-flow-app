insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-page-assets',
  'landing-page-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon']::text[]
)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "landing_page_assets_public_read" on storage.objects;
create policy "landing_page_assets_public_read"
on storage.objects for select
using (bucket_id = 'landing-page-assets');

drop policy if exists "landing_page_assets_authenticated_upload" on storage.objects;
create policy "landing_page_assets_authenticated_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'landing-page-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "landing_page_assets_authenticated_update" on storage.objects;
create policy "landing_page_assets_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'landing-page-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'landing-page-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "landing_page_assets_authenticated_delete" on storage.objects;
create policy "landing_page_assets_authenticated_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'landing-page-assets' and (storage.foldername(name))[1] = auth.uid()::text);
