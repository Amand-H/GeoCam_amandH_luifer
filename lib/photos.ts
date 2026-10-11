import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Abre el selector de la galería. El selector moderno del sistema no requiere
 * permiso de galería para elegir una imagen. Devuelve la URI o null si se cancela.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/** Pregunta con un Alert si se borran todas las fotos (usado por useShake). */
export function confirmClearAll(count: number, clearAll: () => void): void {
  if (count === 0) {
    Alert.alert('GeoCam', 'No hay fotos para borrar.');
    return;
  }
  Alert.alert(
    '¿Borrar todas las fotos?',
    `Agitaste el teléfono. Se eliminarán ${count} foto(s).`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar todo', style: 'destructive', onPress: clearAll },
    ]
  );
}
