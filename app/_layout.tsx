import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { useCharacterStore } from '../src/store/characterStore';
import { applyOfflineProgress } from '../src/engine/idleEngine';
import { signInAnon, onAuthChange } from '../src/services/authService';
import { loadFromCloud } from '../src/services/cloudSave';

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    background: '#050510',
    surface: '#0f0f1f',
    primary: '#a78bfa',
  },
};

export default function RootLayout() {
  const character = useCharacterStore((s) => s.character);

  useEffect(() => {
    // Sign in anonymously and attempt cloud load
    signInAnon().then(async (user) => {
      const loaded = await loadFromCloud(user.uid);
      if (!loaded) {
        // Fresh save — offline progress not applicable
      } else {
        applyOfflineProgress();
      }
    });
  }, []);

  return (
    <PaperProvider theme={darkTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050510' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="create" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modes/adventure" />
        <Stack.Screen name="modes/outworlder" />
        <Stack.Screen name="modes/hero" />
        <Stack.Screen name="modes/transcendent" />
      </Stack>
    </PaperProvider>
  );
}
