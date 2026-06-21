import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, GameButton, Overlay } from '@/ui';

import { getPush } from './provider';
import { markPushSoftAskHandled, shouldShowPushSoftAsk } from './softAsk';

/**
 * Контекстный мягкий запрос разрешения на уведомления.
 * Показывается на Home после первого Game Over (когда игрок вернулся на спокойный
 * экран): не во время геймплея и не поверх оверлея Game Over. Перепроверяется при
 * смене маршрута, поэтому срабатывает в той же сессии, а не только при следующем запуске.
 */
export function PushSoftAskSheet() {
  const lang = useLang();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname === '/' && shouldShowPushSoftAsk()) setVisible(true);
  }, [pathname]);

  if (!visible) return null;

  const close = () => {
    markPushSoftAskHandled();
    setVisible(false);
  };

  const allow = async () => {
    markPushSoftAskHandled();
    setVisible(false);
    try {
      await getPush().requestPermission();
    } catch {
      // Разрешение не получено — пересматривать UI не нужно
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
