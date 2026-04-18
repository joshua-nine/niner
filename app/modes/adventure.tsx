import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdventureMode() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adventure Mode</Text>
      <Text style={styles.sub}>Dungeon runs and auto-battle — coming soon.</Text>
      <Text style={styles.lore}>
        The Wanderer's Society assigns you a dungeon ticket. You step inside.{'\n'}
        The System tries to evaluate the monsters. It evaluates you instead — and hesitates.
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
