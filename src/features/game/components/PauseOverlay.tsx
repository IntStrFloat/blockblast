import { useState } from 'react';
import { View } from 'react-native';
import { useScores } from '@/features/scores';
import { useLang, useSettings } from '@/features/settings';
import { AppText, CandyIcon, GameButton, Overlay, formatNumber, nightCandy as n } from '@/ui';
import { CandyToggle } from '@/ui/primitives/CandyControls';
import { useGameStore } from '../store';

interface PauseOverlayProps {
  onClose: () => void;
  onRestart: () => void;
  onHome: () => void;
}
export function PauseOverlay({ onClose, onRestart, onHome }: PauseOverlayProps) {
  const ru = useLang() === 'ru';
  const sound = useSettings((s) => s.sound);
  const haptics = useSettings((s) => s.haptics);
  const update = useSettings((s) => s.update);
  const score = useGameStore((s) => s.game.score);
  const best = useScores((s) => s.best);
  const [restartArmed, setRestartArmed] = useState(false);
  return (
    <Overlay onDismiss={onClose}>
      <View style={{ gap: 6 }}>
        <AppText preset="title">{ru ? 'Пауза' : 'Paused'}</AppText>
        <AppText style={{ color: n.lavender, fontSize: 14, lineHeight: 20 }}>
          {ru ? 'Счёт' : 'Score'} {formatNumber(score)} · {ru ? 'рекорд' : 'best'}{' '}
          {formatNumber(best)}
        </AppText>
      </View>
      <GameButton
        label={ru ? 'Продолжить' : 'Continue'}
        size="lg"
        icon={<CandyIcon name="play" color={n.sunInk} />}
        onPress={onClose}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GameButton
          style={{ flex: 1 }}
          variant={restartArmed ? 'danger' : 'ghost'}
          label={restartArmed ? (ru ? 'Да, заново' : 'Yes, restart') : ru ? 'Заново' : 'Restart'}
          onPress={() => {
            if (restartArmed) onRestart();
            else setRestartArmed(true);
          }}
        />
        <GameButton
          style={{ flex: 1 }}
          label={ru ? 'Домой' : 'Home'}
          variant="ghost"
          onPress={onHome}
        />
      </View>
      <View style={{ gap: 16, paddingVertical: 8 }}>
        {(
          [
            {
              icon: 'sound',
              label: ru ? 'Звук' : 'Sound',
              value: sound,
              change: (value: boolean) => update({ sound: value }),
            },
            {
              icon: 'vibration',
              label: ru ? 'Вибрация' : 'Haptics',
              value: haptics,
              change: (value: boolean) => update({ haptics: value }),
            },
          ] as const
        ).map((row) => (
          <View key={row.icon} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <CandyIcon name={row.icon} size={22} color={n.lavender} />
            <AppText style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold' }}>{row.label}</AppText>
            <CandyToggle label={row.label} value={row.value} onChange={row.change} />
          </View>
        ))}
      </View>
      <AppText style={{ fontSize: 12, lineHeight: 18, color: n.muted }}>
        {restartArmed
          ? ru
            ? 'Счёт этой партии не сохранится. Нажми ещё раз, чтобы начать заново.'
            : 'This run’s score will be lost. Tap again to restart.'
          : ru
            ? '«Заново» спросит подтверждение вторым нажатием прямо в этой кнопке.'
            : 'Restart asks for confirmation with a second tap on the same button.'}
      </AppText>
    </Overlay>
  );
}
