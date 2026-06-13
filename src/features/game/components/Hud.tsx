import { Pressable, View } from 'react-native';

import { t } from '@/core/i18n';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { AppText, colors } from '@/ui';

import { ComboBadge } from '../effects/ComboBadge';
import { useGameStore } from '../store';

function ScoreCounter() {
  const score = useGameStore((s) => s.game.score);
  return <AppText preset="score">{score}</AppText>;
}

interface HudProps {
  onPause: () => void;
}

export function Hud({ onPause }: HudProps) {
  const best = useScores((s) => s.best);
  const lang = useLang();

  return (
    <View style={{ width: '100%', paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ minWidth: 72 }}>
          <AppText preset="caption">
            {'\u{1F451}'} {t('game.best', lang)}
          </AppText>
          <AppText preset="button" style={{ color: colors.accent }}>
            {best}
          </AppText>
        </View>

        <View style={{ alignItems: 'center' }}>
          <ScoreCounter />
          <ComboBadge />
        </View>

        <Pressable
          onPress={onPause}
          hitSlop={8}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText preset="button">II</AppText>
        </Pressable>
      </View>
    </View>
  );
}
