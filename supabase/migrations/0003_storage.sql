-- To-Do Priority: private bucket for task images
insert into storage.buckets (id, name, public)
values ('task-images', 'task-images', false);

-- Path convention: {user_id}/{task_id}/{uuid}.{ext}
create policy "own task images select" on storage.objects
  for select using (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own task images insert" on storage.objects
  for insert with check (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own task images delete" on storage.objects
  for delete using (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
