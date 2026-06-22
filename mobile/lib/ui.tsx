import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors, radius, space } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette: Record<string, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: '#06101f', border: colors.primary },
    success: { bg: colors.green, fg: '#04130d', border: colors.green },
    danger: { bg: colors.redDim, fg: colors.red, border: 'rgba(248,113,113,0.4)' },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
  };
  const p = palette[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: p.bg, borderColor: p.border, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: p.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({
  label,
  active,
  onPress,
  tone = 'primary',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'primary' | 'green' | 'purple' | 'amber';
}) {
  const toneColor = { primary: colors.primary, green: colors.green, purple: colors.purple, amber: colors.amber }[
    tone
  ];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? toneColor : 'transparent',
          borderColor: active ? toneColor : colors.border,
        },
      ]}
    >
      <Text style={{ color: active ? '#06101f' : colors.textDim, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: colors.textFaint, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '800', fontSize: 15 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
