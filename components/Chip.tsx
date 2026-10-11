import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/constants/theme';

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  tone?: 'accent' | 'warning';
}

export function Chip({ label, active = false, onPress, onLongPress, tone = 'accent' }: Props) {
  const activeColor = tone === 'warning' ? colors.warning : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.chip, active && { backgroundColor: activeColor, borderColor: activeColor }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { color: colors.text, fontWeight: '600', fontSize: 13 },
  activeText: { color: '#0a0a0a' },
});
