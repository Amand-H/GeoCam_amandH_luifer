import { supabase } from '@/lib/supabase';

// Única capa que conoce el bucket privado de Storage
export const BUCKET = 'geocam';
export const SIGNED_URL_SECONDS = 3600;

/**
 * La primera carpeta debe ser el id del usuario: es lo que exigen las políticas RLS del bucket.
 * La ruta depende solo del clientId, así que repetir la subida reemplaza el archivo en vez de duplicarlo.
 */
export function storagePathFor(userId: string, clientId: string): string {
  return `${userId}/${clientId}.jpg`;
}

/** URL temporal para mostrar o descargar una foto del bucket privado. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
