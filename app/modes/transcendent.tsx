import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TranscendentMode() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transcendent Mode</Text>
      <Text style={styles.sub}>Astral rifts and dimensional beings — unlocks at Diamond rank.</Text>
      <Text style={styles.lore}>
        The rift opens. The System stops reporting.{'\n'}
        Beyond Diamond rank, there are no categories left.{'\n'}
        Only you, your past life, and whatever comes through the other side.
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
