import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useCharacterStore } from '../src/store/characterStore';

export default function Index() {
  const router = useRouter();
  const character = useCharacterStore((s) => s.character);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (character) {
        router.replace('/(tabs)/idle');
      } else {
        router.replace('/create');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [character]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#a78bfa" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050510' },
});
