import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { t } from '@/core/i18n';
import { getAds } from '@/features/monetization';
import { useRewardedReady } from '@/features/monetization/useRewardedReady';
import {
  adventureXpBonusPaid,
  claimAdventureXpBonus,
  getAdventureXpOffer,
  hasPendingAdventureXpBonus,
  recoverAdventureXpBonuses,
  trackAdventureXpOffer,
} from '@/features/monetization/adventureXpBonus';
import { useLang } from '@/features/settings';
import { useProgression } from '@/features/progression';
import { AppText, GameButton } from '@/ui';

interface Props {
  completionId: string;
  runId: string;
  disabled?: boolean;
  onOfferAvailable?: () => void;
  onBusyChange?: (busy: boolean) => boolean | void;
}

export function AdventureXpBonus({ completionId, runId, disabled = false, onOfferAvailable, onBusyChange }: Props) {
  const lang = useLang();
  // Receipts can change during startup recovery or in the earned SDK callback.
  useProgression((state) => state.rewardReceipts);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, refresh] = useState(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const announcedRef = useRef<string | null>(null);
  const offer = getAdventureXpOffer(completionId, runId);
  const pending = hasPendingAdventureXpBonus(completionId);
  const paid = adventureXpBonusPaid(completionId);
  const ready = useRewardedReady(offer !== null && !paid && !pending && !busy);

  useEffect(() => {
    mountedRef.current = true;
    recoverAdventureXpBonuses();
    useProgression.getState().presentRevealForRun(runId);
    return () => { mountedRef.current = false; };
  }, [completionId, runId]);

  useEffect(() => {
    if ((!offer || !ready) && !pending) return;
    if (announcedRef.current === completionId) return;
    announcedRef.current = completionId;
    onOfferAvailable?.();
    if (offer) trackAdventureXpOffer(offer, 'offered');
  }, [completionId, offer, onOfferAvailable, pending, ready]);

  const claim = async () => {
    if (!mountedRef.current || busyRef.current || disabled) return;
    if (!offer && !pending) return;
    // The screen atomically acquires the current result before a queued tap can
    // start an ad after Next has already advanced to a different run.
    if (onBusyChange?.(true) === false) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (pending) {
        recoverAdventureXpBonuses();
        if (mountedRef.current) setFailed(hasPendingAdventureXpBonus(completionId));
      } else if (offer) {
        const result = await claimAdventureXpBonus(offer, getAds());
        if (mountedRef.current) setFailed(result === 'pending' || result === 'failed');
      }
      if (mountedRef.current) {
        // The durable reward exists at earned; the short toast starts only
        // after the fullscreen surface is dismissed and this result is visible.
        useProgression.getState().presentRevealForRun(runId);
        refresh((value) => value + 1);
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
      onBusyChange?.(false);
    }
  };

  if (paid && !pending) return (
    <AppText preset="caption" accessibilityLiveRegion="polite" style={{ color: '#FFFFFF' }}>
      {t('adventure.xpBonusApplied', lang)}
    </AppText>
  );
  if (!pending && (!offer || !ready) && !busy && !failed) return null;
  return (
    <View style={{ width: '100%', maxWidth: 300, gap: 6 }}>
      {(pending || (offer && ready)) ? (
        <GameButton
          variant="primary"
          label={pending
            ? t('adventure.xpBonusClaim', lang)
            : t('adventure.xpBonusWatch', lang).replace('{amount}', String(offer?.amount ?? 0))}
          onPress={() => { void claim(); }}
          disabled={disabled || busy}
        />
      ) : null}
      {failed ? (
        <AppText preset="caption" accessibilityLiveRegion="polite" style={{ color: '#FFFFFF', textAlign: 'center' }}>
          {t(pending ? 'adventure.xpBonusPending' : 'adventure.xpBonusFailed', lang)}
        </AppText>
      ) : null}
    </View>
  );
}
