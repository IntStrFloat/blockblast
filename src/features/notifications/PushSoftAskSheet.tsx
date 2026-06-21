import { useEffect, useState } from 'react';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, ClayCard, GameButton, Overlay } from '@/ui';

import { getPush, markPushSoftAskHandled, shouldShowPushSoftAsk } from './index';

/**
 * Контекстный мягкий запрос разрешения на уведомления.
 * Сам решает, показываться ли (после первого Game Over) при монтировании.
 */
export function PushSoftAskSheet() {
  const lang = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (shouldShowPushSoftAsk()) setVisible(true);
  }, []);

  if (!visible) return null;

  const close = () => {
    markPushSoftAskHandled();
    setVisible(false);
  };

  const allow = async () => {
    markPushSoftAskHandled();
    setVisible(false);
    await getPush().requestPermission();
  };

  return (
    <Overlay>
      <ClayCard style={{ gap: 16 }}>
        <AppText preset="title" style={{ textAlign: 'center' }}>
          {t('push.title', lang)}
        </AppText>
        <AppText preset="body" style={{ textAlign: 'center' }}>
          {t('push.body', lang)}
        </AppText>
        <GameButton label={t('push.allow', lang)} onPress={allow} />
        <GameButton label={t('push.later', lang)} variant="ghost" onPress={close} />
      </ClayCard>
    </Overlay>
  );
}
