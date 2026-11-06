import { useGameStore } from '@/features/game/store';
import { useCallback } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLang, useSettings } from '@/features/settings';
import { AppText, CandyCapy, CandyIcon, nightCandy as n } from '@/ui';

import { useReducedMotion } from '@/features/game/animation/useReducedMotion';

import type { EmoteId } from '../logic/types';
import { HelperHint } from './HelperHint';
import { HelperSwap } from './HelperSwap';

/** Functional Classic controls; intentionally independent from mascot visibility/lost state. */
export function HelperControls({
  active = true,
  width,
  compact = false,
  height = compact ? 48 : 70,
  candy = false,
}: {
  active?: boolean;
  candy?: boolean;
  width?: number;
  compact?: boolean;
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const lang = useLang();
  const showMascot = useSettings((state) => state.showMascot);
  const hint = useGameStore((state) => state.helperHint);
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = width ?? Math.max(0, screenWidth - 24 - (compact ? 104 : 144) - 8);
  const slotWidth = Math.max(0, (availableWidth - 6) / 2);
  const ignoreDecorativeEmote = useCallback((_id: EmoteId) => {}, []);

  const pendingSpend = useGameStore((state) =>
    Boolean(state.adventure?.helperSpend || state.classicMeta?.helperSpend),
  );
  if (!active) return null;
  return (
    <View
      testID="helper-controls"
      pointerEvents={pendingSpend ? 'none' : 'box-none'}
      style={[styles.layer, { width: availableWidth, height }]}
    >
      {candy && hint ? (
        <View testID="helper-hint-guidance" accessibilityLiveRegion="polite"
          style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 8, borderRadius: 16, borderWidth: 2,
            borderColor: n.sun, backgroundColor: '#FFFFFF' }}>
          {showMascot ? <CandyCapy size={32} /> : <CandyIcon name="bulb" size={28} color={n.sunEdge} />}
          <View style={{ flex: 1 }}>
            <AppText style={{ color: n.sunInk, fontFamily: 'Nunito_900Black', fontSize: 12, lineHeight: 15 }}>
              {lang === 'ru' ? 'Подсказка готова!' : 'Your hint is ready!'}
            </AppText>
            <AppText numberOfLines={1} adjustsFontSizeToFit
              style={{ color: '#1B1F5E', fontFamily: 'Nunito_800ExtraBold', fontSize: 12, lineHeight: 16 }}>
              {lang === 'ru' ? 'Перетащи выделенную фигуру сюда' : 'Drag the highlighted piece here'}
            </AppText>
          </View>
          <Pressable onPress={() => useGameStore.setState({ helperHint: null })}
            accessibilityRole="button" accessibilityLabel={lang === 'ru' ? 'Скрыть подсказку' : 'Dismiss hint'}
            hitSlop={6} style={{ width: 28, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <CandyIcon name="close" size={16} color="#1B1F5E" />
          </Pressable>
        </View>
      ) : <View pointerEvents="box-none" style={styles.host}>
        <View testID="helper-hint-slot" style={{ width: slotWidth, height: 44, minWidth: 0 }}>
          <HelperHint
            candy={candy}
            onEmote={ignoreDecorativeEmote}
            reduceMotion={reduceMotion}
            compact={compact}
          />
        </View>
        <View testID="helper-swap-slot" style={{ width: slotWidth, height: 44, minWidth: 0 }}>
          <HelperSwap
            candy={candy}
            onEmote={ignoreDecorativeEmote}
            reduceMotion={reduceMotion}
            compact={compact}
          />
        </View>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    justifyContent: 'center',
  },
  host: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
});
