import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoImage } from '@/components/PhotoImage';
import { StatusBanner } from '@/components/StatusBanner';
import { colors } from '@/constants/theme';
import { useCloudPhotos } from '@/hooks/useCloudPhotos';
import type { CloudPhoto } from '@/types/geo';

/** C2: feed de la nube paginado por cursor (12 por página), búsqueda en vivo y 4 estados de UI. */
export default function NubeScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const cloud = useCloudPhotos(search);

  const isFirstLoad = cloud.status === 'pending' && cloud.fetchStatus === 'fetching';
  const offlineNoData = cloud.status === 'pending' && cloud.fetchStatus === 'paused';
  const failedNoData = cloud.status === 'error';

  const loadMore = () => {
    if (cloud.hasNextPage && !cloud.isFetchingNextPage) void cloud.fetchNextPage();
  };

  const renderItem = ({ item }: { item: CloudPhoto }) => (
    <View style={styles.card}>
      <View>
        {item.url ? (
          // Si la URL firmada venció (1 h) la imagen falla y PhotoImage muestra un placeholder
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

  // Los 4 estados sin datos: carga, sin conexión, error con Reintentar y vacío (distinto si hay búsqueda)
  let empty: React.ReactElement;
  if (isFirstLoad) {
    empty = <ActivityIndicator color={colors.accent} size="large" style={styles.center} />;
  } else if (offlineNoData) {
    empty = <Text style={styles.empty}>Sin conexión y sin datos guardados. Conéctate para ver tus fotos de la nube.</Text>;
  } else if (failedNoData) {
    empty = (
      <View style={styles.center}>
        <StatusBanner
          tone="danger"
          message={cloud.error?.message ?? 'No se pudo cargar la nube'}
          actionLabel="Reintentar"
          onPress={() => void cloud.refetch()}
        />
      </View>
    );
  } else if (cloud.appliedSearch) {
    empty = <Text style={styles.empty}>Ninguna nota en la nube contiene «{cloud.appliedSearch}».</Text>;
  } else {
    empty = <Text style={styles.empty}>Aún no tienes fotos en la nube.</Text>;
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Nube</Text>
      {!cloud.isOnline && (
        <View style={styles.banner}>
          <StatusBanner message="Sin conexión. Se muestran los datos guardados." />
        </View>
      )}
      {/* Error al refrescar con datos ya en pantalla: la lista se mantiene y se avisa arriba */}
      {cloud.error && !failedNoData && cloud.isOnline && (
        <View style={styles.banner}>
          <StatusBanner
            tone="danger"
            message={cloud.error.message}
            actionLabel="Reintentar"
            onPress={() => void cloud.refetch()}
          />
        </View>
      )}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar en las notas de la nube…"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        clearButtonMode="while-editing"
      />
      <FlatList
        data={cloud.photos}
        keyExtractor={(item) => item.clientId}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={cloud.isRefetching}
        onRefresh={() => void cloud.refetch()}
        ListEmptyComponent={empty}
        ListFooterComponent={
          cloud.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.footer} /> : undefined
        }
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', paddingHorizontal: 16, marginBottom: 12 },
  banner: { paddingHorizontal: 16, marginBottom: 8 },
  search: {
    marginHorizontal: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
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
  center: { marginTop: 48 },
  footer: { marginVertical: 16 },
});
