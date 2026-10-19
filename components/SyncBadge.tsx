import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import type { GeoPhoto } from '@/types/geo';

/** ☁️ sincronizada, ☁️• subida pero con cambios pendientes, nada si nunca se subió. */
export function SyncBadge({ photo, style }: { photo: GeoPhoto; style?: StyleProp<TextStyle> }) {
  if (photo.isSynced) return <Text style={[styles.badge, style]}>☁️</Text>;
  if (photo.remotePath) return <Text style={[styles.badge, style]}>☁️•</Text>;
  return null;
}

const styles = StyleSheet.create({
  badge: { fontSize: 13 },
});
