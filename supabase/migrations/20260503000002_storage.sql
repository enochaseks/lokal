-- Create the store-images bucket (public so images are readable without auth)
insert into storage.buckets (id, name, public)
values ('store-images', 'store-images', true)
on conflict (id) do nothing;
-- Anyone can read store images
create policy "Public read store images" on storage.objects
  for select to public
  using (bucket_id = 'store-images');
-- Authenticated users can upload; path must start with their uid
create policy "Authenticated upload store images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- Owners can overwrite their own images
create policy "Owner update store images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- Owners can delete their own images
create policy "Owner delete store images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
