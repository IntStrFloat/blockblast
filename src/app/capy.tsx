import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { MascotFigure } from '@/features/mascot';
import { CosmeticIcon } from '@/features/mascot/components/MascotArt';
import { Wardrobe } from '@/features/mascot/components/Wardrobe';
import { COSMETICS } from '@/features/mascot/logic/cosmetics';
import { useMascot } from '@/features/mascot/store';
import { rewardDisplayName, stageForLevel, useProgression } from '@/features/progression';
import { ProfileOverlay } from '@/features/profile';
import { useLang } from '@/features/settings';
import { AppText, CheckIcon, ClayCard, GameButton, LockIcon, ScreenHeader, colors, spacing } from '@/ui';

export default function CapyScreen() {
  const router = useRouter();
  const lang = useLang();
  const [profileOpen, setProfileOpen] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const level = useProgression((s) => s.level);
  const mascot = useMascot();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScreenHeader
        title={t('capy.title', lang)}
        backLabel={t('leaderboard.back', lang)}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.m, gap: spacing.m, paddingBottom: spacing.xl }}>
        <ClayCard raised style={{ alignItems: 'center', gap: spacing.s, paddingVertical: spacing.m }}>
          <View style={{ width: 176, height: 176, alignItems: 'center', justifyContent: 'center', borderRadius: 88, backgroundColor: 'rgba(126,231,255,0.12)', borderWidth: 1, borderColor: 'rgba(126,231,255,0.3)' }}>
            <MascotFigure stage={stageForLevel(level)} equipped={mascot.equipped} size={156} />
          </View>
          <AppText preset="button" style={{ color: colors.accent }}>{t('capy.level', lang)} {level}</AppText>
        </ClayCard>

        <ClayCard style={{ gap: spacing.s }}>
          <AppText preset="button">{t('capy.collection', lang)}</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            {(['skin', 'hat', 'face', 'accessory'] as const).map((slot) => {
              const item = COSMETICS.find((cosmetic) => cosmetic.id === mascot.equipped[slot]) ??
                COSMETICS.find((cosmetic) => cosmetic.slot === slot && mascot.unlocked.includes(cosmetic.id)) ??
                COSMETICS.find((cosmetic) => cosmetic.slot === slot);
              const isUnlocked = item ? mascot.unlocked.includes(item.id) : false;
              const isEquipped = item ? mascot.equipped[slot] === item.id : false;
              return (
                <Pressable
                  key={slot}
                  testID={`capy-collection-${slot}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(`capy.${slot}`, lang)}${item ? `. ${rewardDisplayName({ kind: 'cosmetic', id: item.id }, lang)}` : ''}. ${isEquipped ? lang === 'ru' ? 'Надето' : 'Equipped' : isUnlocked ? t('capy.obtained', lang) : t('capy.soon', lang)}`}
                  onPress={() => setWardrobeOpen(true)}
                  style={{ flex: 1, minHeight: 96, gap: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.cardRaised }}
                >
                  {item ? <CosmeticIcon id={item.id} size={42} muted={!isUnlocked} /> : <LockIcon size={28} />}
                  <View style={{ position: 'absolute', right: 4, top: 4 }}>
                    {isEquipped ? <CheckIcon size={14} color={colors.accent} /> : !isUnlocked ? <LockIcon size={12} /> : null}
                  </View>
                  <AppText preset="caption" style={{ textAlign: 'center', fontSize: 10 }} numberOfLines={1} adjustsFontSizeToFit>{t(`capy.${slot}`, lang)}</AppText>
                </Pressable>
              );
            })}
          </View>
          <GameButton label={t('capy.wardrobe', lang)} onPress={() => { useAnalyticsStore.getState().track('collection_opened', { source: 'capi' }); setWardrobeOpen(true); }} />
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <GameButton label={t('capy.profile', lang)} variant="ghost" onPress={() => setProfileOpen(true)} style={{ flex: 1 }} />
            <GameButton label={t('settings.title', lang)} variant="ghost" onPress={() => router.push('/settings')} style={{ flex: 1 }} />
          </View>
        </ClayCard>
      </ScrollView>
      <ProfileOverlay visible={profileOpen} onClose={() => setProfileOpen(false)} />
      <Wardrobe visible={wardrobeOpen} onClose={() => setWardrobeOpen(false)} />
    </SafeAreaView>
  );
}
