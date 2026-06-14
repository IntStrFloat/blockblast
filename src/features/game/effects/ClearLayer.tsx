import { Fragment } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import type { ClearPresentation, ClearPresentationInstance } from '../animation/clearPresentation';
import { LineHighlightLayer } from './LineHighlightLayer';

interface ClearLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

// Разрушение ячеек ушло в пуловый ClearBurstLayer (см. BoardView): он переиспользует
// фиксированный набор вью и не монтирует Animated.View на каждый фрагмент. Здесь
// остаётся только дешёвая вспышка линии и искры — они живут внутри клиппинга доски.
export function ClearLayer({ presentations }: ClearLayerProps) {
  return (
    <>
      {presentations.map(({ id, presentation }) => (
        <Fragment key={id}>
          <LineHighlightLayer presentation={presentation} />
          <ClearSparkLayer presentation={presentation} />
        </Fragment>
      ))}
    </>
  );
}

interface ClearSparkLayerProps {
  presentation: ClearPresentation;
}

function ClearSparkLayer({ presentation }: ClearSparkLayerProps) {
  if (!presentation) return null;

  return (
    <>
      {presentation.sparks.map((spark) => {
        const animation = new Keyframe({
          0: {
            opacity: 0,
            transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.2 }],
          },
          24: {
            opacity: 1,
            transform: [
              { translateX: spark.dx * 0.25 },
              { translateY: spark.dy * 0.25 },
              { scale: 1.4 },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateX: spark.dx },
              { translateY: spark.dy },
              { scale: 0.1 },
            ],
          },
        })
          .duration(260)
          .delay(spark.delay);

        return (
          <Animated.View
            key={spark.id}
            entering={animation}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spark.x - spark.size / 2,
              top: spark.y - spark.size * 1.8,
              width: spark.size,
              height: spark.size * 3.6,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
            }}
          />
        );
      })}
    </>
  );
}
