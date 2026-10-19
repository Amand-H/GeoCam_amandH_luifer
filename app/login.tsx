import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

function validate(email: string, password: string): string | null {
  if (!email.trim()) return 'Escribe tu correo.';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return null;
}

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Si sale bien, Stack.Protected cambia de pantalla solo al cambiar la sesión
  const submit = async (action: typeof signIn) => {
    const invalid = validate(email, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    const message = await action(email, password);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>GeoCam</Text>
        <Text style={styles.subtitle}>Inicia sesión para guardar tus fotos en la nube.</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!busy}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña (mínimo 6 caracteres)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          editable={!busy}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={() => submit(signIn)}
          disabled={busy}
          style={[styles.button, busy && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => submit(signUp)}
          disabled={busy}
          style={[styles.button, styles.secondary, busy && styles.disabled]}
        >
          <Text style={styles.secondaryText}>Crear cuenta</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: colors.text, fontSize: 36, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginBottom: 12 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { color: colors.danger, textAlign: 'center' },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  buttonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 16 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent },
  secondaryText: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
});
