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
