import { useEffect, useState } from 'react';

/** Devuelve `value` solo cuando dejó de cambiar durante `delayMs` (búsqueda en vivo sin una consulta por tecla). */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
