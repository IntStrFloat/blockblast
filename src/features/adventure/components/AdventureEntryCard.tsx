import { type Href, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText, ChevronIcon, TrophyIcon, colors, radii, spacing } from '@/ui';

import { seasonLength } from '../logic/seasons';
import { useAdventure } from '../store';
import { SeasonCountdownBadge } from './SeasonCountdownBadge';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Карточка входа в «Приключение» на Home. Оформлена как второй герой-акцент,
 * сопоставимый по весу с кнопкой «Играть» (спека 17): насыщенный сине-индиговый
 * градиент из палитры хедера режима + приподнятость и press-scale как у GameButton.
 * Цвет намеренно синий, а не жёлтый — единственный primary-CTA остаётся «Играть».
 */
export function AdventureEntryCard() {
  const router = useRouter();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const len = seasonLength(seasonId);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Приключение"
      onPress={() => router.push('/adventure' as Href)}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      style={[
        {
          borderRadius: radii.card,
          // Непрозрачная база, чтобы «глиняная» тень строилась и на iOS (при overflow ниже).
          backgroundColor: '#3B4EAE',
          shadowColor: colors.clayShadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 6,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          borderRadius: radii.card,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.24)',
        }}
      >
        <LinearGradient
          colors={['#5A79DD', '#3B4EAE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: spacing.m }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
            {/* Кубок в круглой «медали» — фокусная точка карточки */}
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: 'rgba(255,255,255,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.30)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrophyIcon size={26} color="#FFE06B" />
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <AppText preset="button" style={{ color: '#FFFFFF', fontSize: 18 }}>
                Приключение
              </AppText>
              <AppText preset="caption" style={{ color: '#DCE6FF' }}>
                Уровень {levelIndex + 1}/{len}
              </AppText>
              <View style={{ alignSelf: 'flex-start' }}>
                <SeasonCountdownBadge compact />
              </View>
            </View>

            {/* Круглый чеврон как явный CTA-аффорданс */}
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronIcon size={20} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>
      </View>
    </AnimatedPressable>
  );
}
