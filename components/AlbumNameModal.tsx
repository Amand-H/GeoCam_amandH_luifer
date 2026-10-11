import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/constants/theme';

interface Props {
  visible: boolean;
  title: string;
  initialValue?: string;
  /** Devuelve null si se guardó o un mensaje de error para mostrar. */
  onSubmit: (name: string) => Promise<string | null>;
  onClose: () => void;
}

/** Sustituto de Alert.prompt, que no existe en Android. */
export function AlbumNameModal({ visible, title, initialValue = '', onSubmit, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* El key reinicia el formulario cada vez que se abre */}
      {visible && <AlbumNameForm key={initialValue} {...{ title, initialValue, onSubmit, onClose }} />}
    </Modal>
  );
}

function AlbumNameForm({ title, initialValue, onSubmit, onClose }: Omit<Props, 'visible'>) {
  const [name, setName] = useState(initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const message = await onSubmit(name);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          placeholder="Nombre del álbum"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoFocus
          maxLength={40}
          onSubmitEditing={handleSave}
          returnKeyType="done"
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <Pressable onPress={onClose} style={styles.button}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={handleSave} disabled={saving} style={styles.button}>
            <Text style={styles.save}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  input: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 8 },
  cancel: { color: colors.textMuted, fontWeight: '600' },
  save: { color: colors.accent, fontWeight: '700' },
});
