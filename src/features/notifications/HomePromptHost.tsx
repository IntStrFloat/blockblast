import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';
import { AppText, GameButton, Overlay } from '@/ui';

import { claimAutoPrompt } from './autoPromptSession';
import {
  getLocalNotificationPermissionStatus,
  requestLocalNotificationPermission,
} from './local/scheduler';
import { getPush } from './provider';
import {
  markPushSoftAskHandled,
  shouldShowPushSoftAsk,
  type PushPermissionStatus,
} from './softAsk';

export interface HomePromptHostProps {
  ftueComplete: boolean;
  isFirstSession: boolean;
  permissionStatus?: PushPermissionStatus;
  blockingOverlayVisible?: boolean;
  userDialogOpen?: boolean;
}

/** The only host allowed to automatically present a prompt on Home. */
export function HomePromptHost({
  ftueComplete,
  isFirstSession,
  permissionStatus,
  blockingOverlayVisible = false,
  userDialogOpen = false,
}: HomePromptHostProps) {
  const lang = useLang();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [detectedPermissionStatus, setDetectedPermissionStatus] =
    useState<PushPermissionStatus | null>(null);
  const effectivePermissionStatus = permissionStatus ?? detectedPermissionStatus;

  useEffect(() => {
    if (permissionStatus !== undefined) return;
    let active = true;
    void getLocalNotificationPermissionStatus().then((status) => {
      if (active) setDetectedPermissionStatus(status);
    });
    return () => {
      active = false;
    };
  }, [permissionStatus]);

  useEffect(() => {
    if (visible || pathname !== '/' || effectivePermissionStatus === null) return;
    if (
      !shouldShowPushSoftAsk({
        ftueComplete,
        isFirstSession,
        permissionStatus: effectivePermissionStatus,
      })
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (!claimAutoPrompt('notifications', { blockingOverlayVisible, userDialogOpen })) return;
      useAnalyticsStore.getState().track('auto_prompt_shown', { kind: 'notifications' });
      setVisible(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [
    blockingOverlayVisible,
    ftueComplete,
    isFirstSession,
    pathname,
    effectivePermissionStatus,
    userDialogOpen,
    visible,
  ]);

  if (!visible) return null;

  const close = () => {
    markPushSoftAskHandled();
    useAnalyticsStore
      .getState()
      .track('auto_prompt_result', { kind: 'notifications', result: 'later' });
    setVisible(false);
  };

  const allow = async () => {
    markPushSoftAskHandled();
    useAnalyticsStore
      .getState()
      .track('auto_prompt_result', { kind: 'notifications', result: 'accepted' });
    setVisible(false);
    try {
      await requestLocalNotificationPermission();
      await getPush().requestPermission();
    } catch {
      // The soft decision remains handled even if the OS/provider request fails.
    }
  };

  return (
    <Overlay>
      <AppText preset="title" style={{ textAlign: 'center' }}>
        {t('push.title', lang)}
      </AppText>
      <AppText preset="body" style={{ textAlign: 'center' }}>
        {t('push.body', lang)}
      </AppText>
      <GameButton label={t('push.allow', lang)} onPress={allow} />
      <GameButton label={t('push.later', lang)} variant="ghost" onPress={close} />
    </Overlay>
  );
}
