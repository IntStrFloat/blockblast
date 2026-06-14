import { Fragment } from 'react';
import { View } from 'react-native';

import type { ClearPresentationInstance } from '../animation/clearPresentation';
import type { PlacementEffectInstance } from '../animation/gameFeelPresentation';
import { BoardFramePulse } from './BoardFramePulse';
import { BlockCrushLayer } from './BlockCrushLayer';
import { ClearDebrisLayer } from './ClearDebrisLayer';
import { PlacementParticleLayer } from './PlacementParticleLayer';

interface GameEffectsLayerProps {
  presentations: readonly ClearPresentationInstance[];
  placementEffects?: readonly PlacementEffectInstance[];
}

export function GameEffectsLayer({
  presentations,
  placementEffects = [],
}: GameEffectsLayerProps) {
  if (presentations.length === 0 && placementEffects.length === 0) return null;
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
          <PlacementParticleLayer presentation={placement} color={color} />
          {comboFrame.intensity > 0 ? (
            <BoardFramePulse presentation={comboFrame} color={color} />
          ) : null}
        </Fragment>
      ))}
      {presentations.map(({ id, presentation }) => (
        <Fragment key={id}>
          <BlockCrushLayer fragments={presentation.fallingFragments} />
          <ClearDebrisLayer debris={presentation.debris} />
        </Fragment>
      ))}
    </View>
  );
}
