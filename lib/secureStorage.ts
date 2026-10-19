import * as SecureStore from 'expo-secure-store';

// SecureStore puede rechazar valores grandes (algunas versiones de iOS fallan por encima de ~2048 bytes)
// y la sesión de Supabase (JWT + refresh token + usuario) suele superar ese tamaño.
// Por eso se guarda en fragmentos: `${key}.count` con el número de partes y `${key}.0`, `${key}.1`, …
const CHUNK_SIZE = 1000;

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function removeChunks(key: string): Promise<void> {
  const stored = await SecureStore.getItemAsync(countKey(key));
  const count = stored ? Number(stored) : 0;
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
  await SecureStore.deleteItemAsync(countKey(key));
}

/** Adaptador de almacenamiento para supabase-js: misma interfaz que AsyncStorage, pero cifrado. */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const stored = await SecureStore.getItemAsync(countKey(key));
    if (!stored) return null;
    const count = Number(stored);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      // Si falta un fragmento la sesión está corrupta: es mejor pedir login de nuevo
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    // Se borran los fragmentos anteriores para no dejar partes sobrantes si el valor nuevo es más corto
    await removeChunks(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    // El contador se escribe al final: si algo falla a la mitad, getItem no lee una sesión incompleta
    await SecureStore.setItemAsync(countKey(key), String(count));
  },

  removeItem(key: string): Promise<void> {
    return removeChunks(key);
  },
};
