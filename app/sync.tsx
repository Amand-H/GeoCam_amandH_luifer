import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PhotoImage } from '@/components/PhotoImage';
import { colors } from '@/constants/theme';
import { useSync, type PendingPhoto } from '@/hooks/useSync';

/** C4: estado de la sincronización. Se abre al tocar el indicador de GeoCam o Fotos. */
export default function SyncScreen() {
  const sync = useSync();
  const result = sync.lastResult;
  // C5: el error puede venir del ciclo completo (la consulta falló) o de fotos sueltas
  const lastError = sync.error?.message ?? result?.errors[0] ?? null;
  const disabled = !sync.isOnline || sync.isSyncing;

  let status = 'Al día';
  if (!sync.isOnline) status = 'Sin conexión: los cambios se subirán al volver la red';
  else if (sync.isSyncing) status = 'Sincronizando…';
  else if (sync.pendingCount > 0) status = `${sync.pendingCount} por subir`;

  const header = (
    <View style={styles.header}>
      <View style={styles.card}>
        <Row label="Estado" value={status} tone={sync.isOnline ? undefined : colors.warning} />
        <Row
          label="Última sincronización"
          value={result ? new Date(result.finishedAt).toLocaleString('es-CO') : 'Todavía no en esta sesión'}
        />
        {result && (
          <Row
            label="Resultado"
            value={`Subieron ${result.pushed} · bajaron ${result.pulled} · fallaron ${result.failed} · sin archivo ${result.sinArchivo}`}
          />
        )}
        {lastError && <Row label="Último error" value={lastError} tone={colors.danger} />}
      </View>

      <Pressable
        onPress={() => void sync.syncNow()}
        disabled={disabled}
        style={({ pressed }) => [styles.button, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
      >
        {sync.isSyncing ? (
          <ActivityIndicator color="#0a0a0a" />
        ) : (
          <Text style={styles.buttonText}>Sincronizar ahora</Text>
        )}
      </Pressable>
      {!sync.isOnline && <Text style={styles.muted}>Necesitas conexión para sincronizar.</Text>}

      <Text style={styles.section}>
        Pendientes ({sync.pendingCount}
        {sync.sinArchivoCount > 0 ? ` + ${sync.sinArchivoCount} sin archivo` : ''})
      </Text>
    </View>
  );

  return (
    <FlatList
      style={styles.fill}
      contentContainerStyle={styles.content}
      data={sync.pendingPhotos}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <PendingRow photo={item} />}
      ListEmptyComponent={<Text style={styles.muted}>No hay fotos pendientes. Todo está en la nube.</Text>}
    />
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function PendingRow({ photo }: { photo: PendingPhoto }) {
  return (
    <View style={styles.item}>
      <PhotoImage uri={photo.uri} style={styles.thumb} />
      <View style={styles.itemText}>
        <Text style={styles.itemDate}>{new Date(photo.createdAt).toLocaleString('es-CO')}</Text>
        {photo.note ? (
          <Text style={styles.muted} numberOfLines={1}>
            {photo.note}
          </Text>
        ) : null}
        {photo.sinArchivo && (
          <Text style={[styles.muted, { color: colors.warning }]}>Sin archivo: no se puede subir</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  row: { gap: 2 },
  rowLabel: { color: colors.textMuted, fontSize: 12 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: { color: '#0a0a0a', fontWeight: '700' },
  section: { color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 8 },
  muted: { color: colors.textMuted, fontSize: 13 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: 8 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  itemText: { flex: 1, gap: 2 },
  itemDate: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
