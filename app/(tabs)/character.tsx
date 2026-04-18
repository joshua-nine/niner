import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useCharacterStore } from '../../src/store/characterStore';
import { useResourceStore } from '../../src/store/resourceStore';
import RankBadge from '../../src/components/RankBadge';
import EssenceCard from '../../src/components/EssenceCard';
import { ALL_ESSENCES } from '../../src/data/essences';
import { runAchievementChecks } from '../../src/engine/achievementEngine';

const ATTR_LABELS: Record<string, string> = {
  power: 'Power',
  speed: 'Speed',
  spirit: 'Spirit',
  recovery: 'Recovery',
  toughness: 'Toughness',
};

export default function CharacterScreen() {
  const character = useCharacterStore((s) => s.character);
  const resources = useResourceStore((s) => s.resources);
  const discoverEssence = useCharacterStore((s) => s.discoverEssence);

  if (!character) return null;

  const discoveredEssences = ALL_ESSENCES.filter((e) =>
    character.equippedEssenceIds.includes(e.id)
  );

  const DISCOVER_COST = 100;

  function handleDiscover() {
    if (resources.essenceShards < DISCOVER_COST) {
      Alert.alert('Not enough shards', `You need ${DISCOVER_COST} essence shards to attempt discovery.`);
      return;
    }
    if (character!.equippedEssenceIds.length >= character!.essenceSlots) {
      Alert.alert('Slots full', 'You have no empty essence slots.');
      return;
    }
    const undiscovered = ALL_ESSENCES.filter(
      (e) => !character!.equippedEssenceIds.includes(e.id)
    );
    if (undiscovered.length === 0) {
      Alert.alert('All discovered', 'You have found all available essences.');
      return;
    }
    useResourceStore.getState().addResources({ essenceShards: -DISCOVER_COST });

    const roll = Math.random();
    let cumulative = 0;
    let chosen = undiscovered[undiscovered.length - 1];
    for (const e of undiscovered) {
      cumulative += e.discoveryChance;
      if (roll <= cumulative) { chosen = e; break; }
    }
    discoverEssence(chosen.id);
    runAchievementChecks();

    // Apply passive bonuses from new essence abilities
    const passiveAbilities = chosen.abilities.filter(
      (a) => a.passiveBonus && a.rankRequired === 'Iron'
    );
    if (passiveAbilities.length > 0) {
      const totalBonus = passiveAbilities.reduce(
        (acc, a) => ({
          essenceShardsPerSec: (acc.essenceShardsPerSec ?? 0) + (a.passiveBonus?.essenceShardsPerSec ?? 0),
          goldPerSec: (acc.goldPerSec ?? 0) + (a.passiveBonus?.goldPerSec ?? 0),
          manaStonePerSec: (acc.manaStonePerSec ?? 0) + (a.passiveBonus?.manaStonePerSec ?? 0),
          expPerSec: (acc.expPerSec ?? 0) + (a.passiveBonus?.expPerSec ?? 0),
        }),
        {} as Record<string, number>
      );
      useResourceStore.getState().setRates(totalBonus);
    }

    Alert.alert('Essence Discovered!', `You have attuned to the ${chosen.name}.`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Identity */}
      <View style={styles.identity}>
        <RankBadge rank={character.systemRank} size="lg" />
        <View style={styles.identityText}>
          <Text style={styles.name}>{character.name}</Text>
          <Text style={styles.rankNote}>
            {character.systemRank === '???' ? 'Unclassified by the System' : `${character.rank} Rank`}
          </Text>
          <Text style={styles.memories}>
            Past-life memories: {character.pastLifeMemoriesUnlocked} / 10
          </Text>
        </View>
      </View>

      {/* Attributes */}
      <Text style={styles.sectionTitle}>ATTRIBUTES</Text>
      <View style={styles.attributeGrid}>
        {Object.entries(character.attributes).map(([key, val]) => (
          <View key={key} style={styles.attrBox}>
            <Text style={styles.attrLabel}>{ATTR_LABELS[key]}</Text>
            <Text style={styles.attrValue}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Essence Slots */}
      <Text style={styles.sectionTitle}>
        ESSENCE SLOTS ({character.equippedEssenceIds.length}/{character.essenceSlots})
      </Text>
      {discoveredEssences.map((e) => (
        <EssenceCard key={e.id} essence={e} equipped />
      ))}
      {character.equippedEssenceIds.length < character.essenceSlots && (
        <TouchableOpacity style={styles.discoverButton} onPress={handleDiscover}>
          <Text style={styles.discoverButtonText}>
            Discover Essence — {DISCOVER_COST} ◆ Shards
          </Text>
        </TouchableOpacity>
      )}

      {/* Echo Abilities */}
      {character.echoAbilities.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>ECHO ABILITIES (Off-System)</Text>
          {character.echoAbilities.map((echo) => (
            <View key={echo.id} style={styles.echoCard}>
              <Text style={styles.echoName}>{echo.name}</Text>
              <Text style={styles.echoDesc}>{echo.description}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  content: { padding: 20, paddingBottom: 40 },
  identity: { flexDirection: 'row', gap: 14, marginBottom: 24, alignItems: 'center' },
  identityText: { flex: 1 },
  name: { color: '#e5e7eb', fontSize: 20, fontWeight: '700' },
  rankNote: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  memories: { color: '#7c3aed', fontSize: 11, marginTop: 4 },
  sectionTitle: { color: '#4b5563', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10, marginTop: 16 },
  attributeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  attrBox: {
    backgroundColor: '#0f0f1f',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: '28%',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  attrLabel: { color: '#6b7280', fontSize: 10, marginBottom: 4 },
  attrValue: { color: '#a78bfa', fontSize: 18, fontWeight: '700' },
  discoverButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#7c3aed',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  discoverButtonText: { color: '#a78bfa', fontWeight: '600', fontSize: 14 },
  echoCard: {
    backgroundColor: '#12001f',
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  echoName: { color: '#c084fc', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  echoDesc: { color: '#d1d5db', fontSize: 13 },
});
