import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { MascotFigure } from '@/features/mascot';
import { Wardrobe } from '@/features/mascot/components/Wardrobe';
import { useMascot } from '@/features/mascot/store';
import { stageForLevel, useProgression } from '@/features/progression';
import { ProfileOverlay } from '@/features/profile';
import { useLang } from '@/features/settings';
import { AppText, ClayCard, GameButton, ScreenHeader, colors, spacing } from '@/ui';

export default function CapyScreen() {
  const router = useRouter();
  const lang = useLang();
  const [profileOpen, setProfileOpen] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const level = useProgression((s) => s.level);
  const mascot = useMascot();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScreenHeader title="Капи" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.m, gap: spacing.m, paddingBottom: spacing.xl }}>
        <ClayCard raised style={{ alignItems: 'center', gap: spacing.s, paddingVertical: spacing.xl }}>
          <View style={{ width: 176, height: 176, alignItems: 'center', justifyContent: 'center', borderRadius: 88, backgroundColor: 'rgba(126,231,255,0.12)', borderWidth: 1, borderColor: 'rgba(126,231,255,0.3)' }}>
            <MascotFigure stage={stageForLevel(level)} equipped={mascot.equipped} size={156} />
          </View>
          <AppText preset="title" style={{ fontSize: 22 }}>Капи · уровень {level}</AppText>
          <AppText preset="caption" style={{ textAlign: 'center' }}>Твой живой профиль, коллекция и темы доски в одном месте.</AppText>
        </ClayCard>

        <ClayCard style={{ gap: spacing.s }}>
          <AppText preset="button">Коллекция</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            {(['Образ', 'Головной убор', 'Лицо', 'Аксессуар'] as const).map((slot) => (
              <Pressable key={slot} accessibilityRole="button" accessibilityLabel={slot} onPress={() => setWardrobeOpen(true)} style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.cardRaised }}>
                <AppText preset="caption" style={{ textAlign: 'center' }}>{slot}</AppText>
                <AppText preset="caption" style={{ color: colors.accent }}>{mascot.unlocked.length ? 'получено' : 'скоро'}</AppText>
              </Pressable>
            ))}
          </View>
          <GameButton label="Открыть гардероб" onPress={() => { useAnalyticsStore.getState().track('collection_opened', { source: 'capi' }); setWardrobeOpen(true); }} />
          <GameButton label="Профиль и никнейм" variant="ghost" onPress={() => setProfileOpen(true)} />
          <GameButton label={t('settings.title', lang)} variant="ghost" onPress={() => router.push('/settings')} />
        </ClayCard>
      </ScrollView>
      <ProfileOverlay visible={profileOpen} onClose={() => setProfileOpen(false)} />
      <Wardrobe visible={wardrobeOpen} onClose={() => setWardrobeOpen(false)} />
    </SafeAreaView>
  );
}
