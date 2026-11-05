import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { Confetti } from '@/features/game';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { RewardProgressSummary } from '@/features/progression';
import { RewardVisual } from '@/features/progression/components/RewardVisual';
import { rewardDisplayName } from '@/features/progression/logic/presentation';
import { useLang } from '@/features/settings';
import { AppText, CheckIcon, GameButton, TrophyIcon } from '@/ui';

import { seasonRewardCosmetic } from '../logic/config';
import { MosaicView } from './MosaicView';

interface Props {
  seasonId: number;
  onContinue: () => void;
  disabled?: boolean;
  earnedXp?: number;
  lifetimePoints?: number;
  presentationReady?: boolean;
}

export function SeasonCelebration({ seasonId, onContinue, disabled = false, earnedXp = 0, lifetimePoints = 0, presentationReady = true }: Props) {
  const reduced = useReducedMotion();
  const lang = useLang();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cosmeticId = seasonRewardCosmetic(seasonId);
  const reward = cosmeticId ? { kind: 'cosmetic' as const, id: cosmeticId } : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#061A2A' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <TrophyIcon size={58} color="#FFE06B" />
        <AppText preset="title" style={{ fontSize: 24, textAlign: 'center' }}>{t('adventure.seasonComplete', lang)}</AppText>
        <MosaicView seasonId={seasonId} cleared={0} revealed width={Math.min(230, width - 96, height * 0.3)} />
        {reward ? (
          <View accessible accessibilityLabel={rewardDisplayName(reward, lang)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RewardVisual reward={reward} size={44} />
            <CheckIcon size={24} color="#8EEAA0" />
          </View>
        ) : null}
        <RewardProgressSummary earnedXp={earnedXp} lifetimePoints={lifetimePoints} light />
        <GameButton label={t('adventure.nextLevel', lang)} onPress={onContinue} disabled={disabled} style={{ width: '100%', maxWidth: 320 }} />
      </ScrollView>
      {presentationReady && !reduced ? <Confetti count={18} /> : null}
    </View>
  );
}
