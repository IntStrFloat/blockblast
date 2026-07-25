import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, GameButton } from '@/ui';

interface Props {
  onRetry: () => void;
  onExit: () => void;
  disabled?: boolean;
}

export function FailOverlay({ onRetry, onExit, disabled = false }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(4,16,28,0.78)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
        zIndex: 40,
      }}
    >
      <AppText preset="title">Ходов больше нет</AppText>
      <View style={{ gap: 10, width: '80%' }}>
        <GameButton label="Повторить" onPress={onRetry} disabled={disabled} />
        <GameButton label="Выйти" variant="ghost" onPress={onExit} disabled={disabled} />
      </View>
    </Animated.View>
  );
}
