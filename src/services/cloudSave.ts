import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { useCharacterStore } from '../store/characterStore';
import { useResourceStore } from '../store/resourceStore';
import { useAchievementStore } from '../store/achievementStore';
import { useGameModeStore } from '../store/gameModeStore';

interface SaveData {
  character: ReturnType<typeof useCharacterStore.getState>['character'];
  resources: ReturnType<typeof useResourceStore.getState>['resources'];
  rates: ReturnType<typeof useResourceStore.getState>['rates'];
  lifetimeShardsCollected: number;
  lastTickTimestamp: number;
  achievements: ReturnType<typeof useAchievementStore.getState>['achievements'];
  modes: ReturnType<typeof useGameModeStore.getState>['modes'];
  savedAt: number;
}

export async function saveToCloud(uid: string): Promise<void> {
  const db = getFirebaseDb();
  const saveData: SaveData = {
    character: useCharacterStore.getState().character,
    resources: useResourceStore.getState().resources,
    rates: useResourceStore.getState().rates,
    lifetimeShardsCollected: useResourceStore.getState().lifetimeShardsCollected,
    lastTickTimestamp: useResourceStore.getState().lastTickTimestamp,
    achievements: useAchievementStore.getState().achievements,
    modes: useGameModeStore.getState().modes,
    savedAt: Date.now(),
  };
  await setDoc(doc(db, 'users', uid, 'save', 'current'), saveData);
}

export async function loadFromCloud(uid: string): Promise<boolean> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', uid, 'save', 'current'));
  if (!snap.exists()) return false;

  const data = snap.data() as SaveData;
  if (data.character) useCharacterStore.setState({ character: data.character });
  if (data.resources) useResourceStore.setState({ resources: data.resources });
  if (data.rates) useResourceStore.setState({ rates: data.rates });
  if (data.lifetimeShardsCollected !== undefined)
    useResourceStore.setState({ lifetimeShardsCollected: data.lifetimeShardsCollected });
  if (data.lastTickTimestamp) useResourceStore.setState({ lastTickTimestamp: data.lastTickTimestamp });
  if (data.achievements) useAchievementStore.setState({ achievements: data.achievements });
  if (data.modes) useGameModeStore.setState({ modes: data.modes });
  return true;
}
