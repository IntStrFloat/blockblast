import { useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '@/features/game/animation/useReducedMotion';

import type { EmoteId } from '../logic/types';
import { HelperHint } from './HelperHint';
import { HelperSwap } from './HelperSwap';

/** Functional Classic controls; intentionally independent from mascot visibility/lost state. */
export function HelperControls({ active = true, width, compact = false, height = compact ? 48 : 70 }: {
  active?: boolean;
  width?: number;
  compact?: boolean;
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = width ?? Math.max(0, screenWidth - 24 - (compact ? 104 : 144) - 8);
  const slotWidth = Math.max(0, (availableWidth - 6) / 2);
  const ignoreDecorativeEmote = useCallback((_id: EmoteId) => {}, []);

  if (!active) return null;
  return (
    <View testID="helper-controls" pointerEvents="box-none" style={[styles.layer, { width: availableWidth, height }]}>
      <View pointerEvents="box-none" style={styles.host}>
        <View testID="helper-hint-slot" style={{ width: slotWidth, height: 44, minWidth: 0 }}>
          <HelperHint onEmote={ignoreDecorativeEmote} reduceMotion={reduceMotion} compact={compact} />
        </View>
        <View testID="helper-swap-slot" style={{ width: slotWidth, height: 44, minWidth: 0 }}>
          <HelperSwap onEmote={ignoreDecorativeEmote} reduceMotion={reduceMotion} compact={compact} />
        </View>
      </View>
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
