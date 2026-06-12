import { View } from 'react-native';

import { t } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText, GameButton, Overlay } from '@/ui';

interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
}

export function PauseOverlay({ onResume, onRestart, onHome }: PauseOverlayProps) {
  const lang = useLang();
  const sound = useSettings((s) => s.sound);
  const haptics = useSettings((s) => s.haptics);
  const update = useSettings((s) => s.update);

  return (
    <Overlay>
      <AppText preset="title" style={{ textAlign: 'center' }}>
        {t('pause.title', lang)}
      </AppText>

      {/* Быстрые тогглы */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GameButton
          label={`${sound ? '🔊' : '🔇'} ${t('pause.sound', lang)}`}
          variant="ghost"
          onPress={() => update({ sound: !sound })}
          style={{ flex: 1 }}
        />
        <GameButton
          label={`${haptics ? '📳' : '🚫'} ${t('pause.haptics', lang)}`}
          variant="ghost"
          onPress={() => update({ haptics: !haptics })}
          style={{ flex: 1 }}
        />
      </View>

      <GameButton label={t('pause.resume', lang)} onPress={onResume} />
      <GameButton label={t('pause.restart', lang)} variant="ghost" onPress={onRestart} />
      <GameButton label={t('pause.home', lang)} variant="ghost" onPress={onHome} />
    </Overlay>
  );
}
