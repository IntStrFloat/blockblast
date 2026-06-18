import Animated, { Keyframe } from 'react-native-reanimated';

import type { ClearDebris } from '../animation/clearPresentation';

interface ClearDebrisLayerProps {
  debris: readonly ClearDebris[];
}

export function ClearDebrisLayer({ debris }: ClearDebrisLayerProps) {
  return (
    <>
      {debris.map((debris) => {
        const animation = new Keyframe({
          0: {
            opacity: 0,
            transform: [
              { translateX: 0 },
              { translateY: 0 },
              { rotate: '0deg' },
              { scale: 0.65 },
            ],
          },
          16: {
            opacity: 1,
            transform: [
              { translateX: debris.dx * 0.12 },
              { translateY: debris.dy * 0.08 },
              { rotate: `${debris.rotateDeg * 0.12}deg` },
              { scale: 1.04 },
            ],
          },
          62: {
            opacity: 0.94,
            transform: [
              { translateX: debris.dx * 0.72 },
              { translateY: debris.dy * 0.72 },
              { rotate: `${debris.rotateDeg * 0.72}deg` },
              { scale: 0.82 },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateX: debris.dx },
              { translateY: debris.dy },
              { rotate: `${debris.rotateDeg}deg` },
              { scale: 0.24 },
            ],
          },
        })
          .duration(debris.duration)
          .delay(debris.delay);

        return (
          <Animated.View
            key={debris.id}
            entering={animation}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: debris.x - debris.size / 2,
              top: debris.y - debris.size / 2,
              width: debris.size,
              height: debris.size,
              borderRadius: Math.max(1, debris.size * 0.18),
              borderWidth: Math.max(0.5, debris.size * 0.08),
              borderColor: 'rgba(255,255,255,0.72)',
              backgroundColor: debris.color,
            }}
          />
        );
      })}
    </>
  );
}
