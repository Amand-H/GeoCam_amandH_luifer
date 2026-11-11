import { supabase } from '@/lib/supabase';
import { BUCKET, SIGNED_URL_SECONDS } from '@/services/cloudStorage';
import type { CloudPhoto } from '@/types/geo';

// La subida vive en services/sync.ts (Semana 9). Aquí queda lo que todavía usan otras pantallas:
// la lista/realtime de la pestaña Nube (hasta la Fase 8). El borrado físico se retiró (C1: borrado lógico).

interface PhotoRow {
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  taken_at: string;
}

/** Fotos del usuario en la nube (RLS ya filtra por user_id) con URLs firmadas pedidas en un solo lote. */
export async function listRemote(): Promise<CloudPhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .is('deleted_at', null) // C1: las lápidas no se muestran
    .order('taken_at', { ascending: false })
    .returns<PhotoRow[]>();
  if (error) throw new Error(`No se pudieron cargar las fotos de la nube: ${error.message}`);
  if (data.length === 0) return [];

  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrls(
    data.map((row) => row.storage_path),
    SIGNED_URL_SECONDS
  );
  if (signError) throw new Error(`No se pudieron firmar las URLs: ${signError.message}`);
  const urlByPath = new Map(signed.map((s) => [s.path, s.error ? null : s.signedUrl]));

  return data.map((row) => ({
    clientId: row.client_id,
    storagePath: row.storage_path,
    url: urlByPath.get(row.storage_path) ?? null,
    coords:
      row.latitude !== null && row.longitude !== null
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
    note: row.note,
    favorite: row.favorite,
    source: row.source,
    takenAt: new Date(row.taken_at).getTime(),
  }));
}

/**
 * Avisa cuando cambian las fotos del usuario en la nube. Devuelve la función que cierra el canal.
 * Los DELETE se escuchan aparte y sin filtro: Supabase no permite filtrar eventos DELETE
 * (el registro borrado solo trae la llave primaria). No exponen datos: solo disparan una recarga,
 * y la recarga sí pasa por RLS.
 */
export function subscribeToRemoteChanges(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`geocam-photos-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${userId}` },
      onChange
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'photos' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
