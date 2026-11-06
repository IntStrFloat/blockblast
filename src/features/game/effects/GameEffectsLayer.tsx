import { Fragment } from 'react';
import { View } from 'react-native';

import type { PlacementEffectInstance } from '../animation/gameFeelPresentation';
import { BoardFramePulse } from './BoardFramePulse';
import { PlacementParticleLayer } from './PlacementParticleLayer';

interface GameEffectsLayerProps {
  placementEffects?: readonly PlacementEffectInstance[];
}

// Эффекты клира живут в постоянных пулах-сиблингах доски (см. BoardView);
// здесь остаются только эффекты размещения без очистки.
export function GameEffectsLayer({ placementEffects = [] }: GameEffectsLayerProps) {
  if (placementEffects.length === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      {placementEffects.map(({ id, placement, comboFrame, color }) => (
        <Fragment key={id}>
          <PlacementParticleLayer presentation={placement} />
          {comboFrame.intensity > 0 ? (
            <BoardFramePulse presentation={comboFrame} color={color} />
          ) : null}
        </Fragment>
      ))}
    </View>
  );
}
