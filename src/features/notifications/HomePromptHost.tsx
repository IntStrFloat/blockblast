import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';
import { AppText, GameButton, Overlay } from '@/ui';

import { claimAutoPrompt } from './autoPromptSession';
import { getLocalNotificationPermissionStatus } from './local/scheduler';
import { requestNotificationPermissions } from './permissions';
import {
  getPushPromptSnapshot,
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
  const promptSnapshot = getPushPromptSnapshot();
  const reasonMode = promptSnapshot.lastMeaningfulMode ?? 'unknown';

  useEffect(() => {
    if (permissionStatus !== undefined) return;
    let active = true;
    void getLocalNotificationPermissionStatus().then((status) => {
      if (active) setDetectedPermissionStatus(status);
    }).catch(() => {
      if (!active) return;
      setDetectedPermissionStatus('denied');
      useAnalyticsStore.getState().track('notification_permission_probe_error', {
        surface: 'home',
      });
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
    useAnalyticsStore.getState().trackOnce(
      'notification-soft-ask-eligible:' + promptSnapshot.meaningfulSessions,
      'notification_soft_ask_eligible',
      {
        meaningful_sessions: promptSnapshot.meaningfulSessions,
        last_meaningful_mode: reasonMode,
      },
    );
    const timer = setTimeout(() => {
      if (!claimAutoPrompt('notifications', { blockingOverlayVisible, userDialogOpen })) return;
      useAnalyticsStore.getState().track('auto_prompt_shown', { kind: 'notifications' });
      useAnalyticsStore.getState().track('notification_soft_ask_shown', {
        meaningful_sessions: promptSnapshot.meaningfulSessions,
        last_meaningful_mode: reasonMode,
      });
      setVisible(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [
    blockingOverlayVisible,
    ftueComplete,
    isFirstSession,
    pathname,
    effectivePermissionStatus,
    promptSnapshot.meaningfulSessions,
    reasonMode,
    userDialogOpen,
    visible,
  ]);

  if (!visible) return null;

  const close = () => {
    markPushSoftAskHandled();
    useAnalyticsStore
      .getState()
      .track('auto_prompt_result', { kind: 'notifications', result: 'later' });
    useAnalyticsStore.getState().track('notification_soft_ask_result', {
      result: 'later',
      last_meaningful_mode: reasonMode,
    });
    setVisible(false);
  };

  const allow = async () => {
    markPushSoftAskHandled();
    useAnalyticsStore
      .getState()
      .track('auto_prompt_result', { kind: 'notifications', result: 'accepted' });
    useAnalyticsStore.getState().track('notification_soft_ask_result', {
      result: 'accepted',
      last_meaningful_mode: reasonMode,
    });
    setVisible(false);
    await requestNotificationPermissions('soft_ask');
  };

  return (
    <Overlay>
      <AppText preset="title" style={{ textAlign: 'center' }}>
        {t('push.title', lang)}
      </AppText>
      <AppText preset="body" style={{ textAlign: 'center' }}>
        {t(
          reasonMode === 'adventure'
            ? 'push.bodyAdventure'
            : reasonMode === 'classic'
              ? 'push.bodyClassic'
              : 'push.body',
          lang,
        )}
      </AppText>
      <GameButton label={t('push.allow', lang)} onPress={allow} />
      <GameButton label={t('push.later', lang)} variant="ghost" onPress={close} />
    </Overlay>
  );
}
