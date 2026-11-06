import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useLang } from '@/features/settings';
import { AppText } from '../AppText';
import { nightCandy as n } from '../nightCandy';
import { CandyBackground } from './CandyBackground';
import { CandyCapy } from './CandyCapy';
import { CandyLogo } from './CandyLogo';
import { CandyProgress } from './CandyProgress';

export function CandySplash({ onDone }: { onDone: () => void }) {
  const { height, width } = useWindowDimensions();
  const lang = useLang();
  useEffect(() => {
    const timer = setTimeout(onDone, 1200);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <Animated.View
      exiting={FadeOut.duration(280)}
      accessibilityViewIsModal
      style={{ position: 'absolute', inset: 0, zIndex: 2000, backgroundColor: n.night900 }}
    >
      <CandyBackground decorated />
      <View
        style={{
          position: 'absolute',
          top: (height * 250) / 844,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <View style={{ transform: [{ scale: Math.min(1, (width - 40) / 304) }] }}>
          <CandyLogo large />
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          top: (height * 500) / 844,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <CandyCapy size={120} />
      </View>
      <View
        style={{ position: 'absolute', left: 60, right: 60, bottom: (height * 90) / 844, gap: 12 }}
      >
        <CandyProgress value={1} from={0} duration={1200} color={n.sun} height={12} />
        <AppText style={{ textAlign: 'center', color: n.lavender, fontSize: 14, lineHeight: 20 }}>
          {lang === 'ru' ? 'Готовим блоки…' : 'Preparing blocks…'}
        </AppText>
      </View>
    </Animated.View>
  );
}
