import { photosRepo } from '@/db/repositories/photos';
import { supabase } from '@/lib/supabase';
import { readPhotoBytes } from '@/services/photoFiles';
import type { GeoPhoto } from '@/types/geo';

// Única capa que conoce el bucket y la tabla remota
const BUCKET = 'geocam';
const SIGNED_URL_SECONDS = 3600;

/**
 * La primera carpeta debe ser el id del usuario: es lo que exigen las políticas RLS del bucket.
 * La ruta depende solo del clientId, así que repetir la subida reemplaza el archivo en vez de duplicarlo.
 */
function storagePathFor(userId: string, clientId: string): string {
  return `${userId}/${clientId}.jpg`;
}

/**
 * Sube o actualiza una foto. Se puede repetir sin duplicar nada:
 * 1. El archivo solo se sube si la foto nunca llegó al bucket (upsert sobre una ruta fija).
 * 2. La fila se escribe con upsert por client_id: una foto editada actualiza su fila.
 * 3. Si la fila falla y el archivo se subió en este intento, se borra para no dejar huérfanos.
 * 4. markSynced solo al final, cuando todo salió bien.
 */
export async function uploadPhoto(photo: GeoPhoto, userId: string): Promise<void> {
  if (!photo.clientId) throw new Error('La foto aún no tiene identificador de sincronización');

  let path = photo.remotePath;
  let uploadedNow = false;

  if (!path) {
    path = storagePathFor(userId, photo.clientId);
    const { bytes, contentType } = await readPhotoBytes(photo.uri);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw new Error(`No se pudo subir el archivo: ${uploadError.message}`);
    uploadedNow = true;
  }

  // user_id no se envía: la columna toma auth.uid() por defecto y RLS comprueba que coincida
  const { error: rowError } = await supabase.from('photos').upsert(
    {
      client_id: photo.clientId,
      storage_path: path,
      latitude: photo.coords?.latitude ?? null,
      longitude: photo.coords?.longitude ?? null,
      note: photo.note,
      favorite: photo.favorite,
      source: photo.source,
      taken_at: new Date(photo.createdAt).toISOString(),
      updated_at: new Date(photo.updatedAt ?? photo.createdAt).toISOString(),
    },
    { onConflict: 'client_id' }
  );

  if (rowError) {
    if (uploadedNow) {
      // Compensación: sin fila, el archivo quedaría huérfano en el bucket
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([path]);
      if (removeError && __DEV__) console.warn('[cloud] no se pudo borrar el archivo huérfano', path, removeError);
    }
    throw new Error(`No se pudo guardar la foto en la nube: ${rowError.message}`);
  }

  await photosRepo.markSynced(photo.id, path);
}

export interface RemoteRef {
  clientId: string | null;
  remotePath: string | null;
}

/**
 * Borra de la nube primero las filas y luego los archivos.
 * Si fallan las filas no se toca ningún archivo (la foto sigue completa en la nube).
 * Si fallan los archivos, las filas ya no están: reintentar es seguro porque borrar
 * una fila que no existe no da error y vuelve a intentar los archivos.
 */
export async function deleteRemoteMany(refs: RemoteRef[]): Promise<void> {
  const synced = refs.filter((r): r is { clientId: string; remotePath: string } => !!r.clientId && !!r.remotePath);
  if (synced.length === 0) return;

  const { error: rowError } = await supabase
    .from('photos')
    .delete()
    .in('client_id', synced.map((r) => r.clientId));
  if (rowError) throw new Error(`No se pudo borrar de la nube: ${rowError.message}`);

  const { error: fileError } = await supabase.storage.from(BUCKET).remove(synced.map((r) => r.remotePath));
  if (fileError) throw new Error(`No se pudo borrar el archivo de la nube: ${fileError.message}`);
}

export function deleteRemote(photo: RemoteRef): Promise<void> {
  return deleteRemoteMany([photo]);
}

/** URL temporal para mostrar una foto del bucket privado. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
