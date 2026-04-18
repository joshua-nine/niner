import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGameModeStore } from '../../src/store/gameModeStore';
import ModeCard from '../../src/components/ModeCard';

export default function ModesScreen() {
  const modes = useGameModeStore((s) => s.modes);
  const unlockedCount = modes.filter((m) => m.isUnlocked).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Game Modes</Text>
      <Text style={styles.subtitle}>{unlockedCount} of {modes.length} unlocked</Text>
      {modes.map((mode) => (
        <ModeCard key={mode.id} mode={mode} />
      ))}
      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Complete rank achievements to unlock new modes. The Ashen Circle grows impatient.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#e5e7eb', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#6b7280', fontSize: 13, marginBottom: 24 },
  hint: {
    marginTop: 8,
    padding: 14,
    backgroundColor: '#0a0a1a',
    borderRadius: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#374151',
  },
  hintText: { color: '#4b5563', fontSize: 12, fontStyle: 'italic' },
});
