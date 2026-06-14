import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

import { playSound } from '@/features/game';
import { useSettings } from '@/features/settings';

function haptic(fn: () => Promise<void>): void {
  fn().catch(() => {}); // на части Android вибромотора нет
}

/**
 * Звук + хаптика дискретных моментов Капи (спека 09 §16). Всё гейтится
 * настройками sound/haptics. Вызывается по событиям (кормление/левел-ап/потеря/
 * тап), НЕ на горячем drag-пути — звук во время перетаскивания не играет.
 */
export function useMascotFeedback(): {
  onFeed: () => void;
  onLevelUp: () => void;
  onLost: () => void;
  onTap: () => void;
} {
  // Колбэки читают актуальные настройки в момент события (getState) — стабильная
  // идентичность (deps []), без лишних ре-рендеров и повторов.
  const onFeed = useCallback(() => {
    const { sound, haptics } = useSettings.getState();
    if (sound) playSound('feed');
    if (haptics) haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }, []);

  const onLevelUp = useCallback(() => {
    const { sound, haptics } = useSettings.getState();
    if (sound) playSound('levelup');
    if (haptics) {
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    }
  }, []);

  const onLost = useCallback(() => {
    const { sound, haptics } = useSettings.getState();
    if (sound) playSound('lost');
    if (haptics) haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, []);

  const onTap = useCallback(() => {
    if (useSettings.getState().haptics) haptic(() => Haptics.selectionAsync());
  }, []);

  return { onFeed, onLevelUp, onLost, onTap };
}
