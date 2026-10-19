import { Directory, File, Paths } from 'expo-file-system';

// La cámara y el selector de galería entregan archivos en caché, que el sistema puede borrar.
// Se copian a documentos para que la URI guardada en SQLite siga siendo válida.
const photosDir = new Directory(Paths.document, 'photos');

/** Copia la foto a la carpeta de documentos y devuelve la URI permanente. */
export async function persistPhoto(cacheUri: string): Promise<string> {
  if (!photosDir.exists) photosDir.create({ intermediates: true, idempotent: true });
  const source = new File(cacheUri);
  const ext = source.extension || '.jpg';
  const destination = new File(photosDir, `${Date.now()}${ext}`);
  // En SDK 57 copy() es asíncrono (copySync es la variante síncrona)
  await source.copy(destination);
  return destination.uri;
}

/** Borra el archivo si existe. Tolera URIs que ya no existen (p. ej. fotos antiguas en caché). */
export function deletePhotoFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
    if (__DEV__) console.log(`[photoFiles] ${file.name} existe tras borrar: ${new File(uri).exists}`);
  } catch (e) {
    if (__DEV__) console.warn('[photoFiles] no se pudo borrar', uri, e);
  }
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
};

/**
 * Bytes de la foto para subirla. ArrayBuffer y no Blob/FormData: en React Native
 * esos dos terminan en archivos de 0 bytes en Supabase Storage.
 */
export async function readPhotoBytes(uri: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const file = new File(uri);
  // Fotos viejas guardadas con URI de caché (antes de la C5 de la Semana 7) pueden haber desaparecido
  if (!file.exists) throw new Error('El archivo de esta foto ya no existe en el teléfono');
  const bytes = await file.arrayBuffer();
  const contentType = CONTENT_TYPES[file.extension.toLowerCase()] ?? 'image/jpeg';
  return { bytes, contentType };
}
