import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Achievement } from '../types/achievement';

const CATEGORY_COLORS: Record<string, string> = {
  progression: '#3b82f6',
  collection: '#f59e0b',
  combat: '#ef4444',
  exploration: '#22c55e',
  memory: '#a855f7',
  special: '#ec4899',
};

interface Props {
  achievement: Achievement;
}

export default function AchievementItem({ achievement }: Props) {
  const color = CATEGORY_COLORS[achievement.category] ?? '#9ca3af';
  const progressPct = achievement.progress
    ? Math.min(1, achievement.progress.current / achievement.progress.required)
    : achievement.completed ? 1 : 0;

  return (
    <View style={[styles.container, achievement.completed && styles.completed]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.name, achievement.completed && styles.nameCompleted]}>
          {achievement.hidden && !achievement.completed ? '???' : achievement.name}
        </Text>
        {achievement.completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      {(!achievement.hidden || achievement.completed) && (
        <Text style={styles.description}>{achievement.description}</Text>
      )}
      {achievement.progress && !achievement.completed && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressLabel}>
            {achievement.progress.current} / {achievement.progress.required} {achievement.progress.label}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#374151',
  },
  completed: { borderLeftColor: '#22c55e' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  name: { color: '#e5e7eb', fontWeight: '600', fontSize: 14, flex: 1 },
  nameCompleted: { color: '#ffffff' },
  checkmark: { color: '#22c55e', fontWeight: '700', fontSize: 16 },
  description: { color: '#9ca3af', fontSize: 12, marginLeft: 16 },
  progressContainer: { marginTop: 8, marginLeft: 16 },
  progressTrack: { height: 4, backgroundColor: '#374151', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: '#6b7280', fontSize: 11, marginTop: 3 },
});
