import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useAchievementStore } from '../../src/store/achievementStore';
import AchievementItem from '../../src/components/AchievementItem';
import { AchievementCategory } from '../../src/types/achievement';

const FILTERS: { label: string; value: AchievementCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Progression', value: 'progression' },
  { label: 'Collection', value: 'collection' },
  { label: 'Memory', value: 'memory' },
  { label: 'Special', value: 'special' },
];

export default function AchievementsScreen() {
  const achievements = useAchievementStore((s) => s.achievements);
  const [filter, setFilter] = useState<AchievementCategory | 'all'>('all');

  const filtered = achievements.filter(
    (a) => filter === 'all' || a.category === filter
  );
  const completedCount = achievements.filter((a) => a.completed).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Achievements</Text>
        <Text style={styles.count}>{completedCount} / {achievements.length}</Text>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterPill, filter === f.value && styles.filterActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AchievementItem achievement={item} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 8,
  },
  title: { color: '#e5e7eb', fontSize: 22, fontWeight: '700' },
  count: { color: '#a78bfa', fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1f2937',
  },
  filterActive: { backgroundColor: '#7c3aed' },
  filterText: { color: '#6b7280', fontSize: 12 },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
});
