import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

// enableChangeListener es lo que permite a useLiveQuery enterarse de los cambios
export const expoDb = openDatabaseSync('geocam.db', { enableChangeListener: true });
// SQLite no aplica llaves foráneas a menos que se active en cada conexión
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
