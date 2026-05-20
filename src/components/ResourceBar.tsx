import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: number;
  rate: number;
  color?: string;
  icon?: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n < 10 ? 1 : 0);
}

export default function ResourceBar({ label, value, rate, color = '#a78bfa', icon }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {icon} {label}
      </Text>
      <Text style={[styles.value, { color }]}>{formatNumber(value)}</Text>
      <Text style={styles.rate}>+{rate.toFixed(2)}/s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    marginBottom: 6,
  },
  label: { color: '#9ca3af', fontSize: 13, flex: 1 },
  value: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  rate: { color: '#6b7280', fontSize: 11, flex: 1, textAlign: 'right' },
});
