import { View } from 'react-native';
import { Block } from '@/features/game/components/Block';
import { AppText } from '../AppText';
import { nightCandy as n } from '../nightCandy';

export function CandyLogo({ large = false }: { large?: boolean }) {
  const size = large ? 70 : 46;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Блок Бластик"
      style={{ alignItems: 'center', gap: large ? 10 : 7 }}
    >
      <View style={{ flexDirection: 'row', gap: large ? 8 : 5 }}>
        {['Б', 'Л', 'О', 'К'].map((letter, i) => (
          <View
            key={letter}
            style={{
              width: size,
              height: size,
              transform: [{ rotate: `${[-6, 4, -3, 6][i]}deg` }],
            }}
          >
            <Block size={size} color={n.blockColors[[0, 2, 3, 4][i]]} />
            <View
              style={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText
                style={{
                  fontFamily: 'Unbounded_900Black',
                  fontSize: large ? 42 : 28,
                  lineHeight: size,
                  color: n.white,
                  textShadowColor: 'rgba(30,10,70,0.35)',
                  textShadowOffset: { width: 0, height: 3 },
                  textShadowRadius: 0.1,
                }}
              >
                {letter}
              </AppText>
            </View>
          </View>
        ))}
      </View>
      <AppText
        style={{
          fontFamily: 'Unbounded_900Black',
          fontSize: large ? 38 : 25,
          lineHeight: large ? 50 : 34,
          letterSpacing: large ? 0.76 : 0.5,
          color: n.white,
          textShadowColor: n.sunEdge,
          textShadowOffset: { width: 0, height: large ? 5 : 3 },
          textShadowRadius: 0.1,
        }}
      >
        БЛАСТИК
      </AppText>
    </View>
  );
}
