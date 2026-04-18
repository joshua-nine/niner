import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GameModeConfig } from '../types/gameMode';
import { useRouter } from 'expo-router';

interface Props {
  mode: GameModeConfig;
}

export default function ModeCard({ mode }: Props) {
  const router = useRouter();
  const locked = !mode.isUnlocked;

  return (
    <TouchableOpacity
      style={[styles.card, locked && styles.locked]}
      onPress={() => !locked && !mode.comingSoon && router.push(mode.route as any)}
      disabled={locked || mode.comingSoon}
    >
      <View style={styles.header}>
        <Text style={[styles.name, locked && styles.lockedText]}>{mode.name}</Text>
        {locked && <Text style={styles.lockIcon}>🔒</Text>}
        {!locked && mode.comingSoon && <Text style={styles.soonBadge}>SOON</Text>}
      </View>
      <Text style={[styles.description, locked && styles.lockedText]}>{mode.description}</Text>
      <Text style={styles.flavor}>{mode.flavor}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f0f1f',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  locked: { opacity: 0.5, borderStyle: 'dashed' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },
  lockedText: { color: '#6b7280' },
  lockIcon: { fontSize: 16 },
  soonBadge: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'center',
  },
  description: { color: '#9ca3af', fontSize: 13, marginBottom: 6 },
  flavor: { color: '#6b7280', fontSize: 11, fontStyle: 'italic' },
});
