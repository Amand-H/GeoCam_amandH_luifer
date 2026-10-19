import { photosRepo } from '@/db/repositories/photos';
import { supabase } from '@/lib/supabase';
import { readPhotoBytes } from '@/services/photoFiles';
import type { GeoPhoto } from '@/types/geo';

// Única capa que conoce el bucket y la tabla remota
const BUCKET = 'geocam';
const SIGNED_URL_SECONDS = 3600;

/** La primera carpeta debe ser el id del usuario: es lo que exigen las políticas RLS del bucket. */
function storagePathFor(userId: string, clientId: string): string {
  return `${userId}/${clientId}.jpg`;
}

/** Sube el archivo al bucket, crea la fila remota y marca la foto local como sincronizada. */
export async function uploadPhoto(photo: GeoPhoto, userId: string): Promise<void> {
  if (!photo.clientId) throw new Error('La foto aún no tiene identificador de sincronización');

  const { bytes, contentType } = await readPhotoBytes(photo.uri);
  const path = storagePathFor(userId, photo.clientId);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType });
  if (uploadError) throw new Error(`No se pudo subir el archivo: ${uploadError.message}`);

  // user_id no se envía: la columna toma auth.uid() por defecto y RLS comprueba que coincida
  const { error: rowError } = await supabase.from('photos').insert({
    client_id: photo.clientId,
    storage_path: path,
    latitude: photo.coords?.latitude ?? null,
    longitude: photo.coords?.longitude ?? null,
    note: photo.note,
    favorite: photo.favorite,
    source: photo.source,
    taken_at: new Date(photo.createdAt).toISOString(),
    updated_at: new Date(photo.updatedAt ?? photo.createdAt).toISOString(),
  });
  if (rowError) throw new Error(`No se pudo guardar la foto en la nube: ${rowError.message}`);

  await photosRepo.markSynced(photo.id, path);
}

/** URL temporal para mostrar una foto del bucket privado. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
