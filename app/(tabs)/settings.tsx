import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { useCharacterStore } from '../../src/store/characterStore';
import { saveToCloud } from '../../src/services/cloudSave';
import { getCurrentUser } from '../../src/services/authService';

export default function SettingsScreen() {
  const character = useCharacterStore((s) => s.character);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);

  async function handleSave() {
    const user = getCurrentUser();
    if (!user) { Alert.alert('Not signed in'); return; }
    setSaving(true);
    try {
      await saveToCloud(user.uid);
      Alert.alert('Saved', 'Your progress has been saved to the cloud.');
    } catch {
      Alert.alert('Error', 'Could not save. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    Alert.alert(
      'Reset Progress',
      'This will erase all local progress. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => useCharacterStore.setState({ character: null }),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {character && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <Text style={styles.info}>Playing as: {character.name}</Text>
          <Text style={styles.info}>Rank: {character.systemRank}</Text>
          <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save to Cloud'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ true: '#7c3aed', false: '#374151' }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleReset}>
          <Text style={styles.dangerButtonText}>Reset Progress</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Niner: Echoes of Aethermoor — v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510', padding: 20 },
  title: { color: '#e5e7eb', fontSize: 22, fontWeight: '700', marginBottom: 28 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#4b5563', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  info: { color: '#9ca3af', fontSize: 14, marginBottom: 6 },
  button: { backgroundColor: '#7c3aed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { color: '#9ca3af', fontSize: 15 },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#ef4444', fontWeight: '700' },
  version: { color: '#374151', fontSize: 11, textAlign: 'center', marginTop: 'auto' as any },
});
