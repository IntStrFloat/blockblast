import { Fragment } from 'react';
import { View } from 'react-native';

import type { ClearPresentationInstance } from '../animation/clearPresentation';
import { BlockCrushLayer } from './BlockCrushLayer';
import { ClearDebrisLayer } from './ClearDebrisLayer';

interface GameEffectsLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

export function GameEffectsLayer({ presentations }: GameEffectsLayerProps) {
  if (presentations.length === 0) return null;
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
      {presentations.map(({ id, presentation }) => (
        <Fragment key={id}>
          <BlockCrushLayer fragments={presentation.fallingFragments} />
          <ClearDebrisLayer debris={presentation.debris} />
        </Fragment>
      ))}
    </View>
  );
}
