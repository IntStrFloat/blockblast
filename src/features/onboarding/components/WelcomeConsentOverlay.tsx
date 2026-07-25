import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  getLocalNotificationPermissionStatus,
  getPush,
  markPushSoftAskHandled,
  requestLocalNotificationPermission,
} from '@/features/notifications';
import { useLang } from '@/features/settings';
import { AppText, spacing } from '@/ui';

import { useWelcomePromptStore } from '../welcomePromptStore';

function WelcomeMark() {
  return (
    <View style={styles.mark} accessibilityElementsHidden>
      <View style={styles.markFace}>
        <View style={[styles.eye, { left: 27 }]} />
        <View style={[styles.eye, { right: 27 }]} />
        <View style={styles.mouth} />
      </View>
      <View style={styles.heart}>
        <View style={[styles.heartPart, { left: 0 }]} />
        <View style={[styles.heartPart, { right: 0 }]} />
        <View style={styles.heartBase} />
      </View>
    </View>
  );
}

/** First-run notification soft-ask, shown before the tutorial starts. */
export function WelcomeNotificationOverlay() {
  const resolved = useWelcomePromptStore((state) => state.resolved);
  const resolve = useWelcomePromptStore((state) => state.resolve);
  const lang = useLang();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getLocalNotificationPermissionStatus().then((status) => {
      if (!active) return;
      if (status !== 'undetermined') {
        resolve();
        return;
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [resolve]);

  if (resolved || !ready) return null;

  const russian = lang === 'ru';
  const finish = () => {
    markPushSoftAskHandled();
    resolve();
  };

  const allow = async () => {
    finish();
    try {
      await requestLocalNotificationPermission();
      await getPush().requestPermission();
    } catch {
      // The welcome decision still releases FTUE if the OS/provider call fails.
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.wordmark} accessibilityElementsHidden>
        <AppText preset="title" style={styles.wordmarkTop}>BLOCK</AppText>
        <AppText preset="title" style={styles.wordmarkBottom}>BLAST</AppText>
      </View>

      <View style={styles.dialog} accessible accessibilityViewIsModal accessibilityLabel={russian ? 'Разрешение на уведомления' : 'Notification permission'}>
        <WelcomeMark />
        <View style={styles.copy}>
          <AppText preset="title" style={styles.title}>{russian ? 'Напоминать?' : 'Stay in the loop?'}</AppText>
          <AppText preset="body" style={styles.body}>
            {russian
              ? 'Подскажем, когда пора сохранить стрик или вернуться в соревнование.'
              : 'Get a nudge when your streak or a new competition needs attention.'}
          </AppText>
        </View>
        <Pressable onPress={() => void allow()} accessibilityRole="button" accessibilityLabel={russian ? 'Давай' : 'Sure'} style={({ pressed }) => [styles.acceptShadow, pressed && styles.pressed]}>
          <LinearGradient colors={['#39E20E', '#16B900']} style={styles.accept}>
            <AppText preset="title" style={styles.acceptLabel}>{russian ? 'Давай' : 'Sure'}</AppText>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel={russian ? 'Не сейчас' : 'Not now'} hitSlop={8}>
          <AppText preset="body" style={styles.later}>{russian ? 'Не сейчас' : 'Not now'}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06142D', zIndex: 500, paddingHorizontal: 32 },
  wordmark: { position: 'absolute', top: '25%', alignItems: 'center', opacity: 0.18, transform: [{ rotate: '-4deg' }] },
  wordmarkTop: { color: '#E9B51B', fontSize: 58, lineHeight: 66, letterSpacing: -4 },
  wordmarkBottom: { color: '#20BFC8', fontSize: 50, lineHeight: 57, letterSpacing: -4, marginTop: -9 },
  dialog: { width: '100%', maxWidth: 455, alignItems: 'center', gap: spacing.m, paddingHorizontal: 28, paddingTop: 0, paddingBottom: 34, borderRadius: 22, backgroundColor: '#4558C8', borderWidth: 2, borderColor: '#6D9BFF', shadowColor: '#020B20', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  mark: { width: 150, height: 112, marginTop: -68, alignItems: 'center', justifyContent: 'center' },
  markFace: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFD928', borderWidth: 6, borderColor: '#EFAE13', alignItems: 'center', justifyContent: 'center', shadowColor: '#C68100', shadowOpacity: 0.5, shadowRadius: 0, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  eye: { position: 'absolute', top: 39, width: 13, height: 19, borderRadius: 8, backgroundColor: '#493619' },
  mouth: { position: 'absolute', bottom: 29, width: 28, height: 12, borderBottomWidth: 5, borderColor: '#493619', borderRadius: 16 },
  heart: { position: 'absolute', right: 3, bottom: 18, width: 58, height: 52, transform: [{ rotate: '7deg' }] },
  heartPart: { position: 'absolute', top: 0, width: 31, height: 31, borderRadius: 18, backgroundColor: '#F52327' },
  heartBase: { position: 'absolute', left: 8, top: 15, width: 42, height: 42, backgroundColor: '#F52327', transform: [{ rotate: '45deg' }] },
  copy: { alignItems: 'center', gap: 3 },
  title: { fontFamily: 'Fredoka_700Bold', color: '#FFFFFF', fontSize: 24, lineHeight: 29, textAlign: 'center' },
  body: { color: '#FFFFFF', fontSize: 17, lineHeight: 25, textAlign: 'center' },
  acceptShadow: { width: '100%', minHeight: 78, borderRadius: 15, shadowColor: '#075500', shadowOpacity: 0.45, shadowRadius: 5, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  accept: { flex: 1, minHeight: 78, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0B9D00' },
  acceptLabel: { color: '#FFFFFF', fontSize: 30, textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  later: { color: '#D7ECFF', fontSize: 16, lineHeight: 22, textDecorationLine: 'underline' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
});
