import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoImage } from '@/components/PhotoImage';
import { StatusBanner } from '@/components/StatusBanner';
import { colors } from '@/constants/theme';
import { useCloudPhotos } from '@/hooks/useCloudPhotos';
import type { CloudPhoto } from '@/types/geo';

export default function NubeScreen() {
  const insets = useSafeAreaInsets();
  const { photos, isLoading, error, reload } = useCloudPhotos();

  const renderItem = ({ item }: { item: CloudPhoto }) => (
    <View style={styles.card}>
      <View>
        {item.url ? (
          <PhotoImage uri={item.url} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.noImage]}>
            <Text style={styles.muted}>Sin imagen</Text>
          </View>
        )}
        <Text style={styles.badgeLeft}>{item.coords ? '📍' : '∅'}</Text>
        {item.favorite && <Text style={styles.badgeRight}>★</Text>}
      </View>
      <Text style={styles.date}>{new Date(item.takenAt).toLocaleString('es-CO')}</Text>
      {item.note && (
        <Text style={styles.note} numberOfLines={2}>
          {item.note}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Nube</Text>
      {error && (
        <View style={styles.banner}>
          <StatusBanner tone="danger" message={error} actionLabel="Reintentar" onPress={reload} />
        </View>
      )}
      <FlatList
        data={photos}
        keyExtractor={(item) => item.clientId}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={renderItem}
        refreshing={isLoading}
        onRefresh={reload}
        ListEmptyComponent={
          isLoading || error ? null : <Text style={styles.empty}>Aún no tienes fotos en la nube.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', paddingHorizontal: 16, marginBottom: 12 },
  banner: { paddingHorizontal: 16, marginBottom: 8 },
  grid: { padding: 16, gap: 12, flexGrow: 1 },
  row: { gap: 12 },
  card: { flex: 1, maxWidth: '50%', backgroundColor: colors.surface, borderRadius: 12, padding: 8, gap: 4 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  noImage: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  badgeLeft: { position: 'absolute', left: 6, top: 6, fontSize: 14 },
  badgeRight: { position: 'absolute', right: 6, top: 4, fontSize: 18, color: colors.warning },
  date: { color: colors.text, fontWeight: '600', fontSize: 12 },
  note: { color: colors.textMuted, fontSize: 12 },
  muted: { color: colors.textMuted, fontSize: 11 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
});
