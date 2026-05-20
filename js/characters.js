import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, getDocs, getDoc,
  updateDoc, deleteDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

export async function createCharacter(userId) {
  const defaultSheet = {
    ownerId: userId,
    name: 'New Adventurer',
    playerName: '',
    class: '',
    level: 1,
    background: '',
    race: '',
    alignment: '',
    xp: 0,
    inspiration: false,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    hpMax: 10, hpCurrent: 10, hpTemp: 0,
    ac: 10, speed: 30, hitDice: '1d8',
    deathSaveSuccesses: 0, deathSaveFailures: 0,
    profBonus: 2,
    savingThrows: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
    skills: {
      acrobatics: false, animalHandling: false, arcana: false, athletics: false,
      deception: false, history: false, insight: false, intimidation: false,
      investigation: false, medicine: false, nature: false, perception: false,
      performance: false, persuasion: false, religion: false, sleightOfHand: false,
      stealth: false, survival: false
    },
    attacks: [],
    equipment: '',
    cp: 0, sp: 0, ep: 0, gp: 0, pp: 0,
    personalityTraits: '', ideals: '', bonds: '', flaws: '',
    featuresTraits: '',
    backstory: '',
    spellcastingClass: '', spellcastingAbility: '', spellSaveDC: 0, spellAttackBonus: 0,
    spellSlots: { 1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0 },
    spellSlotsUsed: { 1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0 },
    spells: [],
    proficiencies: '',
    notes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'characters'), defaultSheet);
  return ref.id;
}

export async function getCharacters(userId) {
  const q   = query(collection(db, 'characters'), where('ownerId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getCharacter(charId) {
  const snap = await getDoc(doc(db, 'characters', charId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function saveCharacter(charId, data) {
  await updateDoc(doc(db, 'characters', charId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteCharacter(charId) {
  await deleteDoc(doc(db, 'characters', charId));
}
