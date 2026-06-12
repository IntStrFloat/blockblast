import { useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { KEYS, getString, setString } from '@/core/storage';
import { useLang } from '@/features/settings';
import { AppText, colors, radii } from '@/ui';

const HINT_KEYS = ['tutorial.hint1', 'tutorial.hint2', 'tutorial.hint3'] as const;

/**
 * Обучение первой партии: 3 встроенные подсказки, скип касанием (спека 06 —
 * никакого форс-туториала). После третьей — флаг в MMKV, больше не показываем.
 */
export function TutorialHints() {
  const lang = useLang();
  const [step, setStep] = useState(() =>
    getString(KEYS.tutorialDone) === '1' ? HINT_KEYS.length : 0,
  );

  if (step >= HINT_KEYS.length) return null;

  const advance = () => {
    const next = step + 1;
    if (next >= HINT_KEYS.length) setString(KEYS.tutorialDone, '1');
    setStep(next);
  };

  return (
    <Animated.View
      key={step}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(150)}
      style={{
        position: 'absolute',
        left: 24,
        right: 24,
        // absolute не учитывает padding SafeAreaView — отступаем от статусбара вручную
        top: 64,
        alignItems: 'center',
        zIndex: 50,
      }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={advance}
        style={{
          backgroundColor: 'rgba(20,33,66,0.92)',
          borderRadius: radii.button,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <AppText preset="body" style={{ flexShrink: 1 }}>
          {t(HINT_KEYS[step], lang)}
        </AppText>
        <AppText preset="caption" style={{ color: colors.accent }}>
          {t('tutorial.skip', lang)} ({step + 1}/3)
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
