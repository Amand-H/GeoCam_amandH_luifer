import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/theme';
import { useSync } from '@/hooks/useSync';

/**
 * Estado de la sincronización (T6), en GeoCam y Fotos. Al tocarlo abre la pantalla de
 * sincronización (C4), que tiene el botón "Sincronizar ahora".
 */
export function SyncStatus() {
  const router = useRouter();
  const sync = useSync();
  const n = sync.pendingCount;
  const pendientes = `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`;

  let icon = '☁️';
  let color: string = colors.accent;
  let label = 'Al día';

  if (!sync.isOnline) {
    icon = '📴';
    color = colors.warning;
    label = n > 0 ? `Sin conexión · ${pendientes}` : 'Sin conexión';
  } else if (sync.isSyncing) {
    icon = '🔄';
    color = colors.text;
    label = 'Sincronizando…';
  } else if (sync.error) {
    icon = '⚠️';
    color = colors.danger;
    label = 'Error al sincronizar · toca para ver';
  } else if (n > 0) {
    icon = '⬆️';
    color = colors.warning;
    label = pendientes;
  }

  return (
    <Pressable
      onPress={() => router.push('/sync')}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.7 }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Estado de sincronización: ${label}`}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(23,23,23,0.9)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  icon: { fontSize: 12 },
  label: { fontSize: 12, fontWeight: '600' },
});
