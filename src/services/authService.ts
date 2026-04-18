import {
  signInAnonymously,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export async function signInAnon(): Promise<User> {
  const auth = getFirebaseAuth();
  const result = await signInAnonymously(auth);
  return result.user;
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export function getCurrentUser(): User | null {
  return getFirebaseAuth().currentUser;
}
