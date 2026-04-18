import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Essence } from '../types/essence';

const RARITY_COLORS = {
  Common: '#9ca3af',
  Uncommon: '#22c55e',
  Rare: '#3b82f6',
  Epic: '#a855f7',
  Legendary: '#f59e0b',
};

interface Props {
  essence: Essence;
  equipped?: boolean;
  onPress?: () => void;
}

export default function EssenceCard({ essence, equipped, onPress }: Props) {
  const color = RARITY_COLORS[essence.rarity];
  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, { borderColor: color }, equipped && styles.equipped]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color }]}>{essence.name}</Text>
        <Text style={[styles.rarity, { color }]}>{essence.rarity}</Text>
      </View>
      <Text style={styles.category}>{essence.category}</Text>
      <Text style={styles.lore} numberOfLines={2}>{essence.lore}</Text>
      {equipped && <Text style={styles.equippedLabel}>EQUIPPED</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#0f0f1f',
  },
  equipped: { backgroundColor: '#1a1a3a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontWeight: '700', fontSize: 15 },
  rarity: { fontSize: 11, fontWeight: '600', alignSelf: 'center' },
  category: { color: '#6b7280', fontSize: 12, marginBottom: 6 },
  lore: { color: '#9ca3af', fontSize: 12, fontStyle: 'italic' },
  equippedLabel: { color: '#22c55e', fontSize: 10, fontWeight: '700', marginTop: 6, letterSpacing: 1 },
});
