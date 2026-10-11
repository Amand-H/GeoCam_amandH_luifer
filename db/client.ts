import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

// enableChangeListener es lo que permite a useLiveQuery enterarse de los cambios
export const expoDb = openDatabaseSync('geocam.db', { enableChangeListener: true });

// WAL: las lecturas no bloquean el COMMIT de una escritura. Sin esto, una conexión de una
// recarga anterior de Expo Go con una lectura a medias deja "database is locked" al migrar.
// El modo queda guardado en el archivo; si la base está bloqueada al cambiarlo, se sigue
// en el modo anterior y el error aparece en la pantalla de migraciones.
try {
  expoDb.execSync('PRAGMA journal_mode = WAL;');
} catch (e) {
  if (__DEV__) console.warn('[db] no se pudo activar WAL', e);
}

// SQLite no aplica llaves foráneas a menos que se active en cada conexión
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
