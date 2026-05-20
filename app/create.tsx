import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../src/store/characterStore';
import { useAchievementStore } from '../src/store/achievementStore';
import { Gender } from '../src/types/character';
import { startIdleEngine } from '../src/engine/idleEngine';
import { runAchievementChecks } from '../src/engine/achievementEngine';

const GENDERS: { value: Gender; label: string; pronoun: string }[] = [
  { value: 'male', label: 'He / Him', pronoun: 'He' },
  { value: 'female', label: 'She / Her', pronoun: 'She' },
  { value: 'nonbinary', label: 'They / Them', pronoun: 'They' },
];

export default function CreateScreen() {
  const router = useRouter();
  const { createCharacter } = useCharacterStore();
  const { completeAchievement } = useAchievementStore();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [step, setStep] = useState<'intro' | 'name' | 'gender' | 'scan'>('intro');

  function handleCreate() {
    if (!name.trim()) return;
    createCharacter(name.trim(), gender);
    // The System scans them immediately — result is anomalous
    completeAchievement('system_anomaly');
    runAchievementChecks();
    startIdleEngine();
    router.replace('/(tabs)/idle');
  }

  if (step === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.loreTitle}>AETHERMOOR</Text>
        <Text style={styles.loreSubtitle}>Echoes of the Unranked</Text>
        <View style={styles.loreBox}>
          <Text style={styles.loreText}>
            You remember the cold stone floor. The chanting. The smell of ash and copper.
          </Text>
          <Text style={styles.loreText}>
            The Ashen Circle had you kneeling inside their ritual circle when the ceremony went wrong.
          </Text>
          <Text style={styles.loreText}>
            One moment — your world. The next — somewhere else entirely.
          </Text>
          <Text style={styles.loreText}>
            A voice. Not heard. Felt.
          </Text>
          <Text style={[styles.loreText, styles.systemText]}>
            {"[ SYSTEM: New entity detected. Scanning... ]"}
          </Text>
          <Text style={[styles.loreText, styles.systemText]}>
            {"[ SYSTEM: Rank assessment — ERROR. Classification: ??? ]"}
          </Text>
          <Text style={styles.loreText}>
            You should be afraid. Instead, you feel a flicker of something older.{'\n'}
            Like you have lived this before.
          </Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={() => setStep('name')}>
          <Text style={styles.buttonText}>Who are you?</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'name') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <Text style={styles.title}>Your Name</Text>
        <Text style={styles.subtitle}>The System will use this to identify you. Not that it can fully read you.</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor="#4b5563"
          maxLength={24}
          autoFocus
        />
        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={() => name.trim() && setStep('gender')}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'gender') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Your Pronouns</Text>
        <Text style={styles.subtitle}>How does Aethermoor address you?</Text>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[styles.genderOption, gender === g.value && styles.genderSelected]}
            onPress={() => setGender(g.value)}
          >
            <Text style={[styles.genderLabel, gender === g.value && styles.genderLabelSelected]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.button} onPress={handleCreate}>
          <Text style={styles.buttonText}>Begin</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
    justifyContent: 'center',
    padding: 24,
  },
  loreTitle: {
    color: '#a78bfa',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 4,
  },
  loreSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 32,
  },
  loreBox: {
    backgroundColor: '#0a0a1a',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#a78bfa',
    marginBottom: 32,
    gap: 12,
  },
  loreText: { color: '#d1d5db', fontSize: 14, lineHeight: 22 },
  systemText: { color: '#a78bfa', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },
  title: { color: '#e5e7eb', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280', fontSize: 14, marginBottom: 28 },
  input: {
    backgroundColor: '#0f0f1f',
    color: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#374151' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  genderOption: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  genderSelected: { borderColor: '#7c3aed', backgroundColor: '#1a0a3a' },
  genderLabel: { color: '#9ca3af', fontSize: 16, textAlign: 'center' },
  genderLabelSelected: { color: '#a78bfa', fontWeight: '700' },
});
