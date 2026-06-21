import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Lang } from '@/core/i18n';
import { progressionText } from '@/core/i18n/progression';
import {
  deriveMapNodes,
  progressFor,
  useProgression,
  type MapNode,
} from '@/features/progression';
import { useLang } from '@/features/settings';
import { getWorldTheme } from '@/features/themes';
import {
  AppText,
  CheckIcon,
  ChevronIcon,
  ClayCard,
  IconButton,
  LockIcon,
  TrophyIcon,
  colors,
  radii,
  spacing,
} from '@/ui';

const RAIL_WIDTH = 48;
const LINE_WIDTH = 4;

function nodeFill(node: MapNode): string {
  if (node.kind === 'world' && node.themeId) return getWorldTheme(node.themeId).cellColors[0];
  if (node.kind === 'cosmetic') return colors.accent;
  if (node.kind === 'helper') return '#3FA7FF';
  return colors.cardRaised;
}

function rewardLabel(node: MapNode, lang: Lang): string {
  if (node.kind === 'world') return progressionText('worldReward', lang);
  if (node.kind === 'cosmetic') return progressionText('capiStyle', lang);
  if (node.kind === 'helper') return progressionText('helper', lang);
  return progressionText('nothing', lang);
}

/** Один узел «дороги достижений»: рельс с непрерывной линией + карточка награды. */
function RoadNode({
  node,
  current,
  isFirst,
  isLast,
  lang,
}: {
  node: MapNode;
  current: number;
  isFirst: boolean;
  isLast: boolean;
  lang: Lang;
}) {
  const isWorld = node.kind === 'world';
  const isCurrent = node.state === 'current';
  const isDone = node.state === 'done';
  const fill = nodeFill(node);
  const size = isWorld ? 42 : 32;

  // Цвет половин линии: пройденная часть — золото, будущая — приглушённый трек.
  const topColor = node.level <= current ? colors.accent : colors.track;
  const botColor = node.level < current ? colors.accent : colors.track;

  const accentBorder = isCurrent ? colors.accent : isWorld ? fill : undefined;

  return (
    <View style={{ flexDirection: 'row', paddingVertical: spacing.s }}>
      {/* Непрерывная линия дороги через всю высоту строки. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: RAIL_WIDTH / 2 - LINE_WIDTH / 2,
          top: 0,
          bottom: 0,
          width: LINE_WIDTH,
        }}
      >
        <View
          style={{ flex: 1, backgroundColor: isFirst ? 'transparent' : topColor, borderRadius: 2 }}
        />
        <View
          style={{ flex: 1, backgroundColor: isLast ? 'transparent' : botColor, borderRadius: 2 }}
        />
      </View>

      {/* Узел. */}
      <View style={{ width: RAIL_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: isCurrent ? size + 6 : size,
            height: isCurrent ? size + 6 : size,
            borderRadius: 999,
            backgroundColor: node.state === 'locked' ? colors.cardSolid : fill,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: isCurrent ? 3 : node.state === 'locked' ? 1 : 0,
            borderColor: isCurrent ? colors.textPrimary : colors.hairline,
            shadowColor: colors.clayShadow,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.4,
            shadowRadius: 5,
            elevation: 4,
          }}
        >
          {node.state === 'locked' ? (
            <LockIcon size={isWorld ? 18 : 15} />
          ) : isDone ? (
            <CheckIcon size={isWorld ? 20 : 16} color={colors.bgBottom} />
          ) : isWorld ? (
            <TrophyIcon size={20} color={colors.bgBottom} />
          ) : (
            <View
              style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: colors.bgBottom }}
            />
          )}
        </View>
      </View>

      {/* Карточка награды. */}
      <View style={{ flex: 1, justifyContent: 'center', paddingLeft: spacing.s }}>
        <ClayCard
          raised={isCurrent || isWorld}
          accent={accentBorder}
          style={{
            paddingVertical: spacing.s + 2,
            paddingHorizontal: spacing.m,
            opacity: node.state === 'locked' && !isWorld ? 0.6 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText preset="caption" style={{ color: colors.textDim }}>
              {progressionText('lvlShort', lang)} {node.level}
            </AppText>
            {isCurrent ? (
              <View
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 999,
                  paddingHorizontal: spacing.s,
                  paddingVertical: 2,
                }}
              >
                <AppText preset="caption" style={{ color: colors.bgBottom }}>
                  {progressionText('current', lang)}
                </AppText>
              </View>
            ) : null}
          </View>

          <AppText preset={isWorld ? 'button' : 'body'} style={{ marginTop: 2 }}>
            {rewardLabel(node, lang)}
          </AppText>

          {isWorld && node.themeId ? (
            <View style={{ flexDirection: 'row', gap: 5, marginTop: spacing.s }}>
              {getWorldTheme(node.themeId)
                .cellColors.slice(0, 6)
                .map((c, i) => (
                  <View
                    key={`${node.level}-${i}`}
                    style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: c }}
                  />
                ))}
            </View>
          ) : null}
        </ClayCard>
      </View>
    </View>
  );
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
  const fill = total > 0 ? info.pointsInLevel / total : 1;
  const pct = Math.round(fill * 100);
  const worldAccent = getWorldTheme(
    nodes.find((n) => n.kind === 'world')?.themeId ?? 'classic',
  ).cellColors[0];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.s,
          paddingHorizontal: spacing.l,
          paddingTop: spacing.s,
          paddingBottom: spacing.s,
        }}
      >
        <IconButton
          onPress={() => router.back()}
          accessibilityLabel={progressionText('mapTitle', lang)}
          size={44}
        >
          <ChevronIcon direction="left" />
        </IconButton>
        <AppText preset="title" style={{ fontSize: 22 }}>
          {progressionText('mapTitle', lang)}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <ClayCard accent={worldAccent} style={{ gap: spacing.s, marginBottom: spacing.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.button,
                backgroundColor: worldAccent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrophyIcon size={22} color={colors.bgBottom} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText preset="title" style={{ fontSize: 20 }}>
                {progressionText('world', lang)} {info.world}
              </AppText>
              <AppText preset="caption">
                {progressionText('level', lang)} {info.level}
              </AppText>
            </View>
          </View>

          <View
            style={{ height: 12, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden' }}
          >
            <View
              style={{
                width: `${Math.max(fill, 0.03) * 100}%`,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors.accent,
              }}
            />
          </View>
          <AppText preset="caption">
            {info.pointsInLevel} / {total} · {pct}% {progressionText('toNext', lang)}
          </AppText>
        </ClayCard>

        {nodes.map((n, i) => (
          <RoadNode
            key={n.level}
            node={n}
            current={info.level}
            isFirst={i === 0}
            isLast={i === nodes.length - 1}
            lang={lang}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
