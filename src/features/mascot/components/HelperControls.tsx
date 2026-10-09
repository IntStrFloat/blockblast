import { useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { getBoardMetrics } from '@/ui';

import type { EmoteId } from '../logic/types';
import { HelperHint } from './HelperHint';
import { HelperSwap } from './HelperSwap';

/** Functional Classic controls; intentionally independent from mascot visibility/lost state. */
export function HelperControls({ active = true }: { active?: boolean }) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const { boardSize } = getBoardMetrics(width);
  const ignoreDecorativeEmote = useCallback((_id: EmoteId) => {}, []);

  if (!active) return null;
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View pointerEvents="box-none" style={[styles.host, { width: boardSize }]}>
        <HelperHint onEmote={ignoreDecorativeEmote} reduceMotion={reduceMotion} />
        <HelperSwap onEmote={ignoreDecorativeEmote} reduceMotion={reduceMotion} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 35,
  },
  host: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
});
