import Animated, { ZoomIn } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, colors, radii } from '@/ui';

import { useGameStore } from '../store';

/** Индикатор серии у счёта: виден при combo ≥ 2, пульс при росте. */
export function ComboBadge() {
  const combo = useGameStore((s) => s.game.combo);
  const lang = useLang();

  if (combo < 2) return null;

  return (
    <Animated.View
      key={combo}
      entering={ZoomIn.springify().damping(12)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,201,60,0.16)',
        borderRadius: radii.button,
        paddingHorizontal: 10,
        paddingVertical: 4,
        gap: 4,
      }}
    >
      <AppText preset="caption" style={{ color: colors.accent }}>
        🔥 {t('game.combo', lang)} ×{combo}
      </AppText>
    </Animated.View>
  );
}
