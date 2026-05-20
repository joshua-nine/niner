import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { useCharacterStore } from '../../src/store/characterStore';
import { useResourceStore } from '../../src/store/resourceStore';
import { useAchievementStore } from '../../src/store/achievementStore';
import { startIdleEngine, applyOfflineProgress } from '../../src/engine/idleEngine';
import { checkAndApplyRankUp } from '../../src/engine/rankEngine';
import ResourceBar from '../../src/components/ResourceBar';
import RankBadge from '../../src/components/RankBadge';
import { ALL_ACHIEVEMENTS } from '../../src/data/achievements';
import { RANK_EXP_REQUIRED } from '../../src/types/character';

export default function IdleScreen() {
  const character = useCharacterStore((s) => s.character);
  const resources = useResourceStore((s) => s.resources);
  const rates = useResourceStore((s) => s.rates);
  const pendingRewards = useAchievementStore((s) => s.pendingRewardIds);
  const achievements = useAchievementStore((s) => s.achievements);
  const clearPending = useAchievementStore((s) => s.clearPendingReward);

  const [offlineModal, setOfflineModal] = useState<{ shards: number; gold: number; seconds: number } | null>(null);
  const [rewardModal, setRewardModal] = useState<{ name: string; description: string; flavor?: string } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startIdleEngine();
    const offline = applyOfflineProgress();
    if (offline) setOfflineModal(offline);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    checkAndApplyRankUp();
  }, [character?.experience]);

  useEffect(() => {
    if (pendingRewards.length === 0) return;
    const id = pendingRewards[0];
    const ach = achievements.find((a) => a.id === id);
    if (!ach) { clearPending(id); return; }

    if (ach.category === 'memory' && ach.reward?.echoId) {
      const echo = character?.echoAbilities.find((e) => e.id === ach.reward?.echoId);
      setRewardModal({
        name: ach.name,
        description: ach.description,
        flavor: echo?.flavor,
      });
    } else {
      setRewardModal({ name: ach.name, description: ach.description });
    }
    clearPending(id);
  }, [pendingRewards]);

  if (!character) return null;

  const expPct = Math.min(1, character.experience / character.experienceToNext);
  const rankRequired = RANK_EXP_REQUIRED[character.rank];
  const canRankUp = character.experience >= rankRequired && character.rank !== 'Transcendent';

  function formatSeconds(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <RankBadge rank={character.systemRank} size="lg" />
        </Animated.View>
        <View style={styles.headerInfo}>
          <Text style={styles.charName}>{character.name}</Text>
          <Text style={styles.rankLabel}>
            {character.systemRank === '???' ? 'Rank: ??? (Anomaly Detected)' : `Rank: ${character.rank}`}
          </Text>
          <Text style={styles.levelLabel}>Level {character.level}</Text>
        </View>
      </View>

      {/* XP Bar */}
      <View style={styles.expSection}>
        <View style={styles.expTrack}>
          <View style={[styles.expFill, { width: `${expPct * 100}%` as any }]} />
        </View>
        <Text style={styles.expText}>
          {Math.floor(character.experience).toLocaleString()} / {rankRequired.toLocaleString()} XP
        </Text>
        {canRankUp && (
          <TouchableOpacity style={styles.rankUpButton} onPress={() => checkAndApplyRankUp()}>
            <Text style={styles.rankUpText}>RANK UP AVAILABLE</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* System anomaly note */}
      {character.systemRank === '???' && (
        <View style={styles.anomalyBox}>
          <Text style={styles.anomalyText}>
            {'[ SYSTEM: Classification error — entity does not match any known rank signature. Monitoring. ]'}
          </Text>
        </View>
      )}

      {/* Resources */}
      <Text style={styles.sectionTitle}>RESOURCES</Text>
      <ResourceBar label="Essence Shards" value={resources.essenceShards} rate={rates.essenceShardsPerSec} color="#a78bfa" icon="◆" />
      <ResourceBar label="Gold" value={resources.gold} rate={rates.goldPerSec} color="#fbbf24" icon="◉" />
      {resources.manaStones > 0 && (
        <ResourceBar label="Mana Stones" value={resources.manaStones} rate={rates.manaStonePerSec} color="#60a5fa" icon="✦" />
      )}

      {/* Echo abilities */}
      {character.echoAbilities.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ECHO ABILITIES</Text>
          {character.echoAbilities.map((echo) => (
            <View key={echo.id} style={styles.echoCard}>
              <Text style={styles.echoName}>{echo.name}</Text>
              <Text style={styles.echoDesc}>{echo.description}</Text>
              <Text style={styles.echoFlavor}>{echo.flavor}</Text>
            </View>
          ))}
        </>
      )}

      {/* Offline welcome modal */}
      <Modal visible={!!offlineModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Welcome Back</Text>
            <Text style={styles.modalBody}>
              You were away for {offlineModal ? formatSeconds(offlineModal.seconds) : ''}.
            </Text>
            <Text style={styles.modalBody}>
              Aethermoor kept moving.
            </Text>
            <Text style={styles.modalReward}>
              +{offlineModal?.shards.toFixed(0)} Shards{'   '}
              +{offlineModal?.gold.toFixed(0)} Gold
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => setOfflineModal(null)}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Achievement / Memory reward modal */}
      <Modal visible={!!rewardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.memoryLabel}>PAST-LIFE MEMORY</Text>
            <Text style={styles.modalTitle}>{rewardModal?.name}</Text>
            <Text style={styles.modalBody}>{rewardModal?.description}</Text>
            {rewardModal?.flavor && (
              <Text style={styles.modalFlavor}>{rewardModal.flavor}</Text>
            )}
            <TouchableOpacity style={styles.button} onPress={() => setRewardModal(null)}>
              <Text style={styles.buttonText}>I Remember</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  headerInfo: { flex: 1 },
  charName: { color: '#e5e7eb', fontSize: 20, fontWeight: '700' },
  rankLabel: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  levelLabel: { color: '#6b7280', fontSize: 11 },
  expSection: { marginBottom: 20 },
  expTrack: { height: 6, backgroundColor: '#1f2937', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  expFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 3 },
  expText: { color: '#6b7280', fontSize: 11, textAlign: 'right' },
  rankUpButton: {
    marginTop: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  rankUpText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  anomalyBox: {
    backgroundColor: '#1a0a3a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#7c3aed',
  },
  anomalyText: { color: '#a78bfa', fontSize: 11, fontFamily: 'monospace' },
  sectionTitle: { color: '#4b5563', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  echoCard: {
    backgroundColor: '#12001f',
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  echoName: { color: '#c084fc', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  echoDesc: { color: '#d1d5db', fontSize: 13, marginBottom: 6 },
  echoFlavor: { color: '#6b7280', fontSize: 11, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#0f0f1f', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#374151' },
  memoryLabel: { color: '#7c3aed', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  modalTitle: { color: '#e5e7eb', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  modalBody: { color: '#9ca3af', fontSize: 14, lineHeight: 22, marginBottom: 8 },
  modalFlavor: { color: '#7c3aed', fontSize: 12, fontStyle: 'italic', marginTop: 8, marginBottom: 16, lineHeight: 20 },
  modalReward: { color: '#a78bfa', fontSize: 18, fontWeight: '700', textAlign: 'center', marginVertical: 12 },
  button: { backgroundColor: '#7c3aed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
