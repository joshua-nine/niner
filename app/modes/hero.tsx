import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HeroMode() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hero Mode</Text>
      <Text style={styles.sub}>Lead a party into proto-spaces — unlocks at Gold rank.</Text>
      <Text style={styles.lore}>
        Five adventurers follow you into the unknown. They trust you because they've seen what you can do.{'\n'}
        The System classifies this as a Gold-rank expedition.{'\n'}
        It still cannot classify you.
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
