-- GeoCam · Semana 9 (T1). Ejecutar DESPUÉS de schema.sql (Semana 8).
-- Reloj del servidor: cuándo llegó cada cambio a Supabase (cursor de bajada)
alter table public.photos
  add column server_updated_at timestamptz not null default now();

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

create trigger photos_touch_server_updated_at
  before insert or update on public.photos
  for each row execute function public.touch_server_updated_at();

create index photos_user_server_updated_idx
  on public.photos (user_id, server_updated_at);

-- La política UPDATE que pide la guía ("editar las mías") YA existe desde la
-- Semana 8 con el nombre "actualizar las mías" (ver schema.sql). No se duplica.
