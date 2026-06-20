import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { progressionText } from '@/core/i18n/progression';
import { deriveMapNodes, progressFor, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { getWorldTheme } from '@/features/themes';
import { AppText, colors, radii, spacing } from '@/ui';

function nodeColor(kind: string, themeId?: string): string {
  if (kind === 'world' && themeId) return getWorldTheme(themeId).cellColors[0];
  if (kind === 'cosmetic') return colors.accent;
  if (kind === 'helper') return '#3FA7FF';
  return colors.cellEmpty;
}

export default function MapScreen() {
  const router = useRouter();
  const lang = useLang();
  const lifetimePoints = useProgression((s) => s.lifetimePoints);

  const info = progressFor(lifetimePoints);
  const from = Math.max(1, info.level - 4);
  const to = info.level + 12;
  const nodes = deriveMapNodes(lifetimePoints, from, to);
  const total = info.pointsInLevel + info.pointsToNext;
  const pct = total > 0 ? Math.round((info.pointsInLevel / total) * 100) : 100;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.l, gap: spacing.s }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.s }}
        >
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AppText preset="title">{'<'}</AppText>
          </Pressable>
          <AppText preset="title">{progressionText('mapTitle', lang)}</AppText>
        </View>

        <View
          style={{
            backgroundColor: colors.cardGlass,
            borderRadius: radii.card,
            padding: spacing.m,
            gap: spacing.s,
          }}
        >
          <AppText preset="body">
            {progressionText('world', lang)} {info.world} · {progressionText('lvlShort', lang)}{' '}
            {info.level}
          </AppText>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.surface,
              overflow: 'hidden',
            }}
          >
            <View style={{ width: `${pct}%`, height: 8, backgroundColor: colors.accent }} />
          </View>
          <AppText preset="caption">
            {info.pointsInLevel} / {total} {progressionText('toNext', lang)}
          </AppText>
        </View>

        {nodes.map((n) => {
          const isWorld = n.kind === 'world';
          const dot = nodeColor(n.kind, n.themeId);
          const label =
            n.kind === 'world'
              ? progressionText('worldReward', lang)
              : n.kind === 'cosmetic'
                ? progressionText('capiStyle', lang)
                : n.kind === 'helper'
                  ? progressionText('helper', lang)
                  : progressionText('nothing', lang);
          return (
            <View
              key={n.level}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 6,
                opacity: n.state === 'locked' ? 0.45 : 1,
              }}
            >
              <View
                style={{
                  width: isWorld ? 30 : 20,
                  height: isWorld ? 30 : 20,
                  borderRadius: isWorld ? 15 : 10,
                  backgroundColor: dot,
                  borderWidth: n.state === 'current' ? 2 : 0,
                  borderColor: colors.textPrimary,
                }}
              />
              <AppText preset="caption" style={{ width: 56 }}>
                {progressionText('lvlShort', lang)} {n.level}
              </AppText>
              <AppText preset={isWorld ? 'body' : 'caption'} style={{ flex: 1 }}>
                {label}
                {n.state === 'current' ? ` · ${progressionText('current', lang)}` : ''}
              </AppText>
              {n.approachingThemeId ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: getWorldTheme(n.approachingThemeId).cellColors[0],
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
