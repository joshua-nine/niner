import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SystemRank, RANK_COLORS, Rank } from '../types/character';

interface Props {
  rank: SystemRank;
  size?: 'sm' | 'md' | 'lg';
}

export default function RankBadge({ rank, size = 'md' }: Props) {
  const color = rank === '???' ? '#a855f7' : RANK_COLORS[rank as Rank];
  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 18 : 13;
  const padding = size === 'sm' ? 3 : size === 'lg' ? 8 : 5;

  return (
    <View style={[styles.badge, { borderColor: color, paddingHorizontal: padding + 4, paddingVertical: padding }]}>
      <Text style={[styles.text, { color, fontSize }]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 1,
  },
});
