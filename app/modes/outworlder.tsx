import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OutworlderMode() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Outworlder Mode</Text>
      <Text style={styles.sub}>Faction politics and society quests — unlocks at Silver rank.</Text>
      <Text style={styles.lore}>
        The factions have noticed you. The Arcane Consortium wants to study you.{'\n'}
        The Temple of Balance wants to judge you.{'\n'}
        The Ashen Circle wants you back.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510', justifyContent: 'center', padding: 24 },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#6b7280', fontSize: 14, marginBottom: 20 },
  lore: { color: '#9ca3af', fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
});
