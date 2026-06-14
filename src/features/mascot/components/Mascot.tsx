import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { mascotPalette } from '@/ui';

import type { Slot, Stage } from '../logic/types';

/**
 * Набор shared values, полностью управляющих Капи на UI-потоке.
 * Анимирует их отдельная задача-планировщик; компонент только читает.
 */
export interface MascotMotion {
  /** Смещение по X (px) — ходьба по полосе. */
  x: SharedValue<number>;
  /** Подпрыгивание по Y (px) — дыхание/боб. */
  bob: SharedValue<number>;
  /** Сжатие/растяжение по X (squash/stretch), нейтраль 1. */
  scaleX: SharedValue<number>;
  /** Сжатие/растяжение по Y, нейтраль 1. */
  scaleY: SharedValue<number>;
  /** Разворот по горизонтали: -1 или 1. */
  facing: SharedValue<number>;
  /** Поворот в градусах — падение/фейсплант. */
  rotate: SharedValue<number>;
  /** Открытость глаз 0..1 (моргание; 1 — открыты). */
  eyeOpen: SharedValue<number>;
  /** Прозрачность 0..1 — затухание при «потере». */
  opacity: SharedValue<number>;
}

/** Создаёт shared values маскота в нейтральном состоянии. */
export function useMascotMotion(): MascotMotion {
  return {
    x: useSharedValue(0),
    bob: useSharedValue(0),
    scaleX: useSharedValue(1),
    scaleY: useSharedValue(1),
    facing: useSharedValue(1),
    rotate: useSharedValue(0),
    eyeOpen: useSharedValue(1),
    opacity: useSharedValue(1),
  };
}

export interface MascotProps {
  motion: MascotMotion;
  stage: Stage;
  equipped?: Partial<Record<Slot, string>>;
  size?: number;
}

/**
 * Капи — View-композиция тельца-«батона» с глянцем, ушами, мордочкой,
 * моргающими глазами и косметикой. Все движения — через shared values.
 */
export function Mascot({ motion, stage, equipped, size = 60 }: MascotProps) {
  const { bob, scaleX, scaleY, facing, rotate, eyeOpen, opacity } = motion;
  // горизонтальное положение применяет родительский слой (MascotLayer), чтобы тень/эмоция двигались вместе

  // Внешний контейнер: наклон, squash/stretch, флип, прозрачность.
  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: bob.value },
      { rotate: `${rotate.value}deg` },
      { scaleX: scaleX.value * facing.value },
      { scaleY: scaleY.value },
    ],
  }));

  // Моргание: сжатие глаза по вертикали.
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeOpen.value }],
  }));

  // Геометрия от size.
  const bodyW = size;
  const bodyH = Math.round(size * 0.9);
  const earSize = Math.round(size * 0.26);
  const eyeSize = stage === 1 ? Math.round(size * 0.2) : Math.round(size * 0.15);
  const muzzleW = Math.round(size * 0.42);
  const muzzleH = Math.round(size * 0.3);
  const blushW = Math.round(size * 0.2);
  const blushH = Math.round(size * 0.12);
  const headBlock = Math.round(size * 0.22);

  const isMax = stage === 4;

  return (
    <Animated.View style={[styles.root, { width: bodyW, height: bodyH }, containerStyle]}>
      {/* Аура (только стадия 4): большой мягкий круг за тельцем. */}
      {isMax ? (
        <View
          pointerEvents="none"
          style={[
            styles.aura,
            {
              width: bodyW * 1.6,
              height: bodyW * 1.6,
              borderRadius: bodyW * 0.8,
              left: -bodyW * 0.3,
              top: -bodyW * 0.3,
            },
          ]}
        />
      ) : null}

      {/* Уши. */}
      <View
        style={[
          styles.ear,
          { width: earSize, height: earSize, borderRadius: earSize / 2, left: earSize * 0.2, top: 0 },
        ]}
      />
      <View
        style={[
          styles.ear,
          {
            width: earSize,
            height: earSize,
            borderRadius: earSize / 2,
            right: earSize * 0.2,
            top: 0,
          },
        ]}
      />

      {/* Тельце-батон с вертикальным градиентом и глянцем. */}
      <View style={[styles.body, { width: bodyW, height: bodyH }]}>
        <LinearGradient
          colors={[mascotPalette.body0, mascotPalette.body1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Глянец сверху. */}
        <View style={[styles.gloss, { height: Math.round(bodyH * 0.3) }]} />
      </View>

      {/* Корона из 3 блоков (только стадия 4). */}
      {isMax ? (
        <View style={styles.crown}>
          <View style={[styles.crownBlock, { width: headBlock * 0.8, height: headBlock * 0.8 }]} />
          <View
            style={[
              styles.crownBlock,
              { width: headBlock, height: headBlock, backgroundColor: mascotPalette.crown1 },
            ]}
          />
          <View
            style={[
              styles.crownBlock,
              { width: headBlock * 0.8, height: headBlock * 0.8, backgroundColor: mascotPalette.crown2 },
            ]}
          />
        </View>
      ) : null}

      {/* Фирменный блок на голове (стадии 2+). */}
      {stage >= 2 && !isMax ? (
        <View
          style={[
            styles.headBlock,
            { width: headBlock, height: headBlock, top: -headBlock * 0.4 },
          ]}
        />
      ) : null}

      {/* Глаза (моргают через eyeOpen). */}
      <View style={[styles.eyeRow, { top: bodyH * 0.32 }]}>
        <Animated.View
          style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }, eyeStyle]}
        />
        <Animated.View
          style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }, eyeStyle]}
        />
      </View>

      {/* Румянец. */}
      <View style={[styles.blushRow, { top: bodyH * 0.48 }]}>
        <View
          style={[styles.blush, { width: blushW, height: blushH, borderRadius: blushH / 2 }]}
        />
        <View
          style={[styles.blush, { width: blushW, height: blushH, borderRadius: blushH / 2 }]}
        />
      </View>

      {/* Мордочка в нижней части. */}
      <View
        style={[
          styles.muzzle,
          {
            width: muzzleW,
            height: muzzleH,
            borderRadius: muzzleH / 2,
            bottom: bodyH * 0.08,
          },
        ]}
      />

      {/* Косметика (оверлеи поверх тельца). */}
      {equipped
        ? (Object.keys(equipped) as Slot[]).map((slot) => {
            const id = equipped[slot];
            return id ? <View key={slot}>{renderCosmetic(id, size)}</View> : null;
          })
        : null}
    </Animated.View>
  );
}

/**
 * Расширяемый каталог косметики: рисует представительное подмножество id
 * простыми View-формами. Неизвестные id → null.
 */
function renderCosmetic(id: string, size: number) {
  // face-* очки/солнцезащитные: тёмная полоса поверх глаз.
  if (id === 'face-sunglasses' || id === 'face-glasses') {
    const w = Math.round(size * 0.66);
    const h = Math.round(size * 0.16);
    return (
      <View
        pointerEvents="none"
        style={[
          styles.cosmeticCenter,
          {
            top: size * 0.3,
            width: w,
            height: h,
            borderRadius: h / 2,
            backgroundColor: id === 'face-sunglasses' ? mascotPalette.ink : 'rgba(43,36,64,0.5)',
          },
        ]}
      />
    );
  }

  // acc-headphones: дужка + две чашки у ушей.
  if (id === 'acc-headphones') {
    const band = Math.round(size * 0.7);
    const cup = Math.round(size * 0.2);
    return (
      <View pointerEvents="none" style={[styles.cosmeticCenter, { top: -size * 0.05 }]}>
        <View
          style={{
            width: band,
            height: Math.round(size * 0.12),
            borderTopLeftRadius: band,
            borderTopRightRadius: band,
            borderWidth: Math.round(size * 0.05),
            borderBottomWidth: 0,
            borderColor: mascotPalette.ink,
          }}
        />
        <View style={[styles.headphoneCups, { width: band + cup }]}>
          <View
            style={{ width: cup, height: cup, borderRadius: cup / 3, backgroundColor: mascotPalette.ink }}
          />
          <View
            style={{ width: cup, height: cup, borderRadius: cup / 3, backgroundColor: mascotPalette.ink }}
          />
        </View>
      </View>
    );
  }

  // acc-scarf: полоса-шарф под мордочкой.
  if (id === 'acc-scarf') {
    const w = Math.round(size * 0.8);
    const h = Math.round(size * 0.16);
    return (
      <View
        pointerEvents="none"
        style={[
          styles.cosmeticCenter,
          {
            bottom: size * 0.05,
            width: w,
            height: h,
            borderRadius: h / 2,
            backgroundColor: mascotPalette.blush,
          },
        ]}
      />
    );
  }

  // hat-*: обобщённая шапка-форма на голове.
  if (id.startsWith('hat-')) {
    const w = Math.round(size * 0.6);
    const h = Math.round(size * 0.28);
    return (
      <View
        pointerEvents="none"
        style={[
          styles.cosmeticCenter,
          {
            top: -h * 0.5,
            width: w,
            height: h,
            borderTopLeftRadius: h,
            borderTopRightRadius: h,
            backgroundColor: mascotPalette.ear,
          },
        ]}
      />
    );
  }

  // TODO: more cosmetics (face-star-eyes, acc-cape, skin-*, aura-* и пр.)
  return null;
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    backgroundColor: 'rgba(255,210,63,0.18)',
  },
  body: {
    borderRadius: 999,
    overflow: 'hidden',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ear: {
    position: 'absolute',
    backgroundColor: mascotPalette.ear,
    zIndex: -1,
  },
  headBlock: {
    position: 'absolute',
    backgroundColor: mascotPalette.block,
    borderRadius: 3,
  },
  crown: {
    position: 'absolute',
    top: -14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  crownBlock: {
    backgroundColor: mascotPalette.block,
    borderRadius: 2,
  },
  eyeRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
  },
  eye: {
    backgroundColor: mascotPalette.ink,
  },
  blushRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 14,
  },
  blush: {
    backgroundColor: mascotPalette.blush,
    opacity: 0.55,
  },
  muzzle: {
    position: 'absolute',
    backgroundColor: mascotPalette.muzzle,
  },
  cosmeticCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headphoneCups: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
});
