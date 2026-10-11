import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { colors } from '@/constants/theme';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
}

/** Imagen con placeholder: las fotos antiguas guardadas con URI de caché pueden ya no existir. */
export function PhotoImage({ uri, style }: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);

  if (failedUri === uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.icon}>🖼️</Text>
        <Text style={styles.text}>No disponible</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={style} onError={() => setFailedUri(uri)} />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 20, opacity: 0.6 },
  text: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
});
