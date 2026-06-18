import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import type { CrushFragment, FallingFragment } from '../animation/clearPresentation';
import { Block } from '../components/Block';

interface BlockCrushLayerProps {
  fragments: readonly (CrushFragment | FallingFragment)[];
}

function animationForFragment(fragment: CrushFragment | FallingFragment) {
  if (fragment.kind === 'falling') {
    return new Keyframe({
      0: {
        opacity: 1,
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { rotate: '0deg' },
          { scaleX: 1 },
          { scaleY: 1 },
        ],
      },
      20: {
        opacity: 1,
        transform: [
          { translateX: fragment.impulseX },
          { translateY: fragment.impulseY },
          { rotate: `${fragment.rotateDeg * 0.14}deg` },
          { scaleX: 1.04 },
          { scaleY: 0.98 },
        ],
      },
      52: {
        opacity: 0.96,
        transform: [
          { translateX: fragment.dx * 0.42 },
          { translateY: fragment.dy * 0.42 },
          { rotate: `${fragment.rotateDeg * 0.52}deg` },
          { scaleX: 0.9 },
          { scaleY: 0.92 },
        ],
      },
      100: {
        opacity: 0,
        transform: [
          { translateX: fragment.dx },
          { translateY: fragment.dy },
          { rotate: `${fragment.rotateDeg}deg` },
          { scaleX: 0.22 },
          { scaleY: 0.22 },
        ],
      },
    })
      .duration(fragment.duration)
      .delay(fragment.delay);
  }

  return fragment.reducedMotion
    ? new Keyframe({
        0: { opacity: 1, transform: [{ scale: 1 }] },
        52: { opacity: 0.9, transform: [{ scale: 1.035 }] },
        100: { opacity: 0, transform: [{ scale: 0.92 }] },
      })
        .duration(180)
        .delay(fragment.delay)
    : new Keyframe({
        0: {
          opacity: 1,
          transform: [
            { translateX: 0 },
            { translateY: 0 },
            { rotate: '0deg' },
            { scaleX: 1 },
            { scaleY: 1 },
          ],
        },
        24: {
          opacity: 1,
          transform: [
            { translateX: 0 },
            { translateY: 0 },
            { rotate: '0deg' },
            { scaleX: 1.08 },
            { scaleY: 0.82 },
          ],
        },
        46: {
          opacity: 1,
          transform: [
            { translateX: fragment.dx * 0.24 },
            { translateY: fragment.dy * 0.24 },
            { rotate: `${fragment.rotateDeg * 0.25}deg` },
            { scaleX: 0.98 },
            { scaleY: 1.04 },
          ],
        },
        100: {
          opacity: 0,
          transform: [
            { translateX: fragment.dx },
            { translateY: fragment.dy },
            { rotate: `${fragment.rotateDeg}deg` },
            { scaleX: 0.26 },
            { scaleY: 0.26 },
          ],
        },
      })
        .duration(210)
        .delay(fragment.delay);
}

export function BlockCrushLayer({ fragments }: BlockCrushLayerProps) {
  return (
    <>
      {fragments.map((fragment) => {
        return (
          <Animated.View
            key={fragment.id}
            entering={animationForFragment(fragment)}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: fragment.x,
              top: fragment.y,
              width: fragment.width,
              height: fragment.height,
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'absolute', left: fragment.sourceX, top: fragment.sourceY }}>
              <Block size={fragment.sourceSize} color={fragment.color} />
            </View>
          </Animated.View>
        );
      })}
    </>
  );
}
