import { useAuth } from '@/context/AuthContext';

/**
 * Dueño de los datos locales = usuario de la sesión. Las pantallas que usan esto están protegidas,
 * pero al cerrar sesión se renderizan una última vez sin usuario: '' no coincide con ninguna fila.
 */
export function useOwnerId(): string {
  return useAuth().userId ?? '';
}
