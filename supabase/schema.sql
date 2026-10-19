-- ===== Tabla remota de fotos =====
create table public.photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null unique,          -- UUID creado en el teléfono: identifica la misma foto en ambos lados
  storage_path text not null unique,
  latitude double precision,
  longitude double precision,
  note text,
  favorite boolean not null default false,
  source text not null check (source in ('camera', 'gallery')),
  taken_at timestamptz not null,
  updated_at timestamptz not null,         -- última modificación hecha por el usuario
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create policy "ver las mías" on public.photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear las mías" on public.photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "borrar las mías" on public.photos
  for delete to authenticated using ((select auth.uid()) = user_id);
-- (casa C1/C2) upsert de una foto editada después de subirla
create policy "actualizar las mías" on public.photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- (casa C4) cambios en vivo para la pestaña Nube
alter publication supabase_realtime add table public.photos;

-- ===== Bucket privado: las fotos con ubicación son datos personales =====
insert into storage.buckets (id, name, public) values ('geocam', 'geocam', false);

create policy "subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "leer mi carpeta" on storage.objects
  for select to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- (casa C2) reemplazar un archivo con upsert necesita INSERT + SELECT + UPDATE
create policy "reemplazar en mi carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
