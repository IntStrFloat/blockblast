import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { fireText, praiseText } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText } from '@/ui';

import { useGameStore } from '../store';

interface Banner {
  id: number;
  text: string;
  fire: string | null;
}

/**
 * Похвала за очистку: scale 0.6→1 overshoot + fade-out вверх, 700мс (спека 04).
 * Absolute fill поверх доски, pointerEvents none.
 */
export function PraiseBanner() {
  const lastEvent = useGameStore((s) => s.lastEvent);
  const tone = useSettings((s) => s.praiseTone);
  const lang = useLang();
  const [banner, setBanner] = useState<Banner | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.praise === 'none') return;
    const id = ++counter.current;
    setBanner({
      id,
      text: praiseText(lastEvent.praise, tone, lang),
      fire: lastEvent.onFire ? fireText(tone, lang, lastEvent.combo) : null,
    });
    const timer = setTimeout(() => {
      if (counter.current === id) setBanner(null);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  if (!banner) return null;

  const kf = new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.6 }, { translateY: 0 }] },
    25: { opacity: 1, transform: [{ scale: 1.08 }, { translateY: 0 }] },
    40: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
    75: { opacity: 1, transform: [{ scale: 1 }, { translateY: -8 }] },
    100: { opacity: 0, transform: [{ scale: 1 }, { translateY: -36 }] },
  }).duration(700);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View key={banner.id} entering={kf} style={{ opacity: 0, alignItems: 'center' }}>
        <AppText
          preset="title"
          style={{
            fontSize: 30,
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 8,
          }}
        >
          {banner.text}
        </AppText>
        {banner.fire ? (
          <AppText preset="button" style={{ marginTop: 4, color: '#FFC93C' }}>
            🔥 {banner.fire}
          </AppText>
        ) : null}
      </Animated.View>
    </View>
  );
}
