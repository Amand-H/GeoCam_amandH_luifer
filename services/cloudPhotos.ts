import { supabase } from '@/lib/supabase';
import { BUCKET, SIGNED_URL_SECONDS } from '@/services/cloudStorage';
import type { CloudPhoto } from '@/types/geo';

// Lectura de la pestaña Nube (C2). La subida y la bajada a SQLite viven en services/sync.ts.

export const CLOUD_PAGE_SIZE = 12;

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

export interface CloudPage {
  items: CloudPhoto[];
  /** taken_at de la última foto de la página; null si no hay más. */
  nextCursor: string | null;
}

/** % y _ son comodines de ILIKE: se escapan para buscar el texto tal cual lo escribió el usuario. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Una página de fotos del usuario en la nube (RLS ya filtra por user_id), de la más reciente a la
 * más antigua. Paginación por CURSOR (`taken_at < cursor`), no por range(): si llega una foto nueva
 * mientras se recorre la lista, las páginas siguientes no se corren ni repiten filas.
 * Las URLs firmadas se piden en un solo lote por página (createSignedUrls).
 */
export async function listRemotePage({
  cursor,
  search,
}: {
  cursor: string | null;
  search: string;
}): Promise<CloudPage> {
  let query = supabase
    .from('photos')
    .select('client_id, storage_path, latitude, longitude, note, favorite, source, taken_at')
    .is('deleted_at', null) // C1: las lápidas no se muestran
    .order('taken_at', { ascending: false })
    .limit(CLOUD_PAGE_SIZE);
  if (cursor) query = query.lt('taken_at', cursor);
  const term = search.trim();
  if (term) query = query.ilike('note', `%${escapeLike(term)}%`);

  const { data, error } = await query.returns<PhotoRow[]>();
  if (error) throw new Error(`No se pudieron cargar las fotos de la nube: ${error.message}`);
  if (data.length === 0) return { items: [], nextCursor: null };

  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrls(
    data.map((row) => row.storage_path),
    SIGNED_URL_SECONDS
  );
  if (signError) throw new Error(`No se pudieron firmar las URLs: ${signError.message}`);
  const urlByPath = new Map(signed.map((s) => [s.path, s.error ? null : s.signedUrl]));

  const items = data.map((row) => ({
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

  // Página incompleta = no hay más. Si no, el cursor es el taken_at (texto de Postgres) de la última
  return { items, nextCursor: data.length < CLOUD_PAGE_SIZE ? null : data[data.length - 1].taken_at };
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
