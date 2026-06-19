import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Line,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';

import { mascotPalette } from '@/ui';

import type { HelperId, Slot, Stage } from '../logic/types';

interface MascotFigureProps {
  stage: Stage;
  equipped?: Partial<Record<Slot, string>>;
  size: number;
  eyeStyle?: object;
}

interface CosmeticIconProps {
  id: string;
  size?: number;
  muted?: boolean;
}

interface SlotGlyphProps {
  slot: Slot;
  size?: number;
}

interface HelperGlyphProps {
  helperId: HelperId;
  size?: number;
}

const P = mascotPalette;

const SKINS: Record<string, { light: string; mid: string; shadow: string }> = {
  default: { light: P.furLight, mid: P.furMid, shadow: P.furShadow },
  'skin-mint': { light: P.skinMint0, mid: P.skinMint1, shadow: '#157E62' },
  'skin-coral': { light: P.skinCoral0, mid: P.skinCoral1, shadow: '#9F3F52' },
  'skin-chrome': { light: '#FFFFFF', mid: P.chrome, shadow: '#8398B4' },
  'skin-obsidian': { light: '#515B86', mid: P.obsidian, shadow: '#101421' },
};

export function MascotFigure({ stage, equipped, size, eyeStyle }: MascotFigureProps) {
  const skin = SKINS[equipped?.skin ?? 'default'] ?? SKINS.default;
  const faceItem = equipped?.face;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Defs>
          <LinearGradient id="capiBody" x1="25" y1="14" x2="76" y2="88">
            <Stop offset="0" stopColor={skin.light} />
            <Stop offset="0.58" stopColor={skin.mid} />
            <Stop offset="1" stopColor={skin.shadow} />
          </LinearGradient>
          <LinearGradient id="capiGloss" x1="28" y1="20" x2="76" y2="70">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {renderAura(equipped?.aura, stage)}
        {renderBackAccessory(equipped?.accessory)}

        <Path
          d="M24 35c0-12 10-22 26-22s26 10 26 22v5c8 5 13 13 13 23 0 19-16 29-39 29S11 82 11 63c0-10 5-18 13-23v-5z"
          fill="url(#capiBody)"
        />
        <Circle cx="29" cy="29" r="11" fill={skin.shadow} />
        <Circle cx="71" cy="29" r="11" fill={skin.shadow} />
        <Circle cx="30" cy="30" r="6" fill={P.innerEar} opacity="0.8" />
        <Circle cx="70" cy="30" r="6" fill={P.innerEar} opacity="0.8" />
        <Path
          d="M23 37c4-12 15-18 31-17 14 1 24 7 27 18-11-7-42-10-58-1z"
          fill="url(#capiGloss)"
        />
        <Path
          d="M23 70c11 11 43 13 58 0-4 14-16 22-31 22s-25-8-27-22z"
          fill={skin.shadow}
          opacity="0.16"
        />
        <Ellipse cx="50" cy="61" rx="24" ry="15" fill={P.muzzle} />
        <Ellipse cx="39" cy="61" rx="8" ry="5" fill={P.blush} opacity="0.22" />
        <Ellipse cx="61" cy="61" rx="8" ry="5" fill={P.blush} opacity="0.22" />
        <Path d="M45 58c2-3 8-3 10 0-1 3-3 5-5 5s-4-2-5-5z" fill={P.ink} />
        <Path
          d="M50 63c0 5-4 8-9 8M50 63c0 5 4 8 9 8"
          stroke={P.ink}
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {stage >= 2 ? <BlockMark stage={stage} /> : null}
        {stage >= 4 ? <Path d="M39 17l6 7 5-10 5 10 6-7 1 13H38l1-13z" fill={P.block} /> : null}
        {renderHat(equipped?.hat)}
        {renderAccessoryFront(equipped?.accessory)}
        {renderFace(faceItem)}
      </Svg>

      {faceItem === 'face-star-eyes' || faceItem === 'face-vr-visor' ? null : (
        <View pointerEvents="none" style={styles.eyeRow}>
          <Animated.View style={[styles.eye, eyeStyle]}>
            <View style={styles.eyeSpark} />
          </Animated.View>
          <Animated.View style={[styles.eye, eyeStyle]}>
            <View style={styles.eyeSpark} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

export function CosmeticIcon({ id, size = 34, muted = false }: CosmeticIconProps) {
  const opacity = muted ? 0.58 : 1;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" opacity={opacity}>
      {renderCosmeticPreview(id)}
    </Svg>
  );
}

export function SlotGlyph({ slot, size = 18 }: SlotGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {slot === 'hat' ? renderHat('hat-panama') : null}
      {slot === 'face' ? renderFace('face-glasses') : null}
      {slot === 'accessory' ? renderAccessoryFront('acc-headphones') : null}
      {slot === 'skin' ? (
        <>
          <Circle cx="36" cy="45" r="18" fill={P.skinMint1} />
          <Circle cx="58" cy="38" r="18" fill={P.skinCoral1} />
          <Circle cx="52" cy="62" r="18" fill={P.block} />
        </>
      ) : null}
      {slot === 'aura' ? renderAura('aura-stars', 4) : null}
    </Svg>
  );
}

export function HelperGlyph({ helperId, size = 20 }: HelperGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {helperId === 'hint' ? (
        <>
          <Path
            d="M50 12c-17 0-29 12-29 28 0 10 5 18 13 23 3 2 5 6 5 10h22c0-4 2-8 5-10 8-5 13-13 13-23 0-16-12-28-29-28z"
            fill={P.block}
          />
          <Path d="M39 82h22M42 91h16" stroke={P.hatOrange} strokeWidth="8" strokeLinecap="round" />
          <Path d="M50 26v20M40 38h20" stroke={P.ink} strokeWidth="7" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path
            d="M24 35h36l-8-9 8-9 22 18-22 18 8-9H24V35z"
            fill={P.accessoryTeal}
          />
          <Path
            d="M76 65H40l8 9-8 9-22-18 22-18-8 9h44v9z"
            fill={P.hatPurple}
          />
        </>
      )}
    </Svg>
  );
}

export function LockGlyph({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Rect x="20" y="43" width="60" height="45" rx="12" fill={P.hatDeep} />
      <Path d="M34 43V31c0-10 7-18 16-18s16 8 16 18v12" stroke={P.block} strokeWidth="10" />
      <Circle cx="50" cy="64" r="6" fill={P.block} />
      <Path d="M50 69v9" stroke={P.block} strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}

export function MascotMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Circle cx="50" cy="50" r="42" fill={P.blockTint} />
      <Path
        d="M28 43c0-11 9-20 22-20s22 9 22 20v3c6 4 9 10 9 18 0 15-12 23-31 23s-31-8-31-23c0-8 3-14 9-18v-3z"
        fill={P.furMid}
      />
      <Circle cx="36" cy="38" r="9" fill={P.furShadow} />
      <Circle cx="64" cy="38" r="9" fill={P.furShadow} />
      <Ellipse cx="50" cy="62" rx="18" ry="10" fill={P.muzzle} />
      <Circle cx="42" cy="51" r="4" fill={P.ink} />
      <Circle cx="58" cy="51" r="4" fill={P.ink} />
    </Svg>
  );
}

export function GiftGlyph({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M17 41h66v41c0 6-4 10-10 10H27c-6 0-10-4-10-10V41z" fill={P.hatPurple} />
      <Path d="M12 29h76v18H12V29z" fill={P.block} />
      <Path d="M44 29h12v63H44V29z" fill={P.hatOrange} />
      <Path d="M19 47h62" stroke={P.hatDeep} strokeOpacity="0.2" strokeWidth="4" />
      <Path d="M48 29c-20 0-28-8-25-17 2-7 12-8 18-1 4 4 6 10 7 18z" fill={P.accessoryTeal} />
      <Path d="M52 29c20 0 28-8 25-17-2-7-12-8-18-1-4 4-6 10-7 18z" fill={P.auraPink} />
      <Circle cx="50" cy="39" r="9" fill={P.hatOrange} />
    </Svg>
  );
}

export function CandyGlyph({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M10 42l18-14 8 14-8 14-18-14zM90 58L72 72l-8-14 8-14 18 14z" fill={P.auraBlue} />
      <Rect x="28" y="26" width="44" height="48" rx="18" fill={P.scarf} />
      <Path d="M38 32c7 11 11 25 11 38M55 29c7 12 11 25 11 38" stroke={P.block} strokeWidth="7" strokeLinecap="round" />
      <Path d="M30 38c9-8 23-10 39-5" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

function renderCosmeticPreview(id: string): ReactNode {
  if (id.startsWith('skin-')) {
    const skin = SKINS[id] ?? SKINS.default;
    return (
      <>
        <Circle cx="50" cy="50" r="34" fill={skin.mid} />
        <Path d="M25 42c9-14 34-19 51-3-12-5-36-3-51 3z" fill={skin.light} opacity="0.7" />
        <Ellipse cx="50" cy="62" rx="20" ry="12" fill={P.muzzle} opacity="0.9" />
      </>
    );
  }
  if (id.startsWith('aura-')) return renderAura(id, 4);
  return renderHat(id) ?? renderFace(id) ?? renderAccessoryFront(id) ?? renderBackAccessory(id);
}

function renderAura(id: string | undefined, stage: Stage): ReactNode {
  if (!id && stage < 4) return null;
  if (id === 'aura-fire') {
    return (
      <G opacity="0.85">
        <Path d="M25 78c-9-19 4-30 8-44 7 11 3 18 13 27 2-18 18-25 17-42 18 19 25 36 12 59H25z" fill={P.auraFire} opacity="0.36" />
        <Path d="M40 80c-5-13 4-19 9-30 3 9 10 13 8 30H40z" fill={P.block} opacity="0.65" />
      </G>
    );
  }
  if (id === 'aura-rainbow') {
    return (
      <G opacity="0.82">
        <Path d="M15 67a35 35 0 0170 0" stroke={P.auraPink} strokeWidth="7" strokeLinecap="round" />
        <Path d="M24 67a26 26 0 0152 0" stroke={P.block} strokeWidth="7" strokeLinecap="round" />
        <Path d="M33 67a17 17 0 0134 0" stroke={P.accessoryTeal} strokeWidth="7" strokeLinecap="round" />
      </G>
    );
  }
  return (
    <G opacity={id === 'aura-sparkles' ? 0.95 : 0.75}>
      <Circle cx="50" cy="54" r="44" fill={P.auraBlue} opacity="0.11" />
      <Star cx={23} cy={27} r={8} fill={P.block} />
      <Star cx={78} cy={33} r={6} fill={id === 'aura-stars' ? P.auraPink : P.auraBlue} />
      <Circle cx="22" cy="76" r="4" fill={P.auraPink} />
      <Circle cx="82" cy="72" r="3" fill={P.block} />
    </G>
  );
}

function renderBackAccessory(id: string | undefined): ReactNode {
  if (id === 'acc-cape') {
    return <Path d="M29 48c-14 13-17 31-7 43 17-3 31-10 42-25L29 48z" fill={P.cape} opacity="0.82" />;
  }
  if (id === 'acc-jetpack') {
    return (
      <G>
        <Rect x="15" y="43" width="16" height="34" rx="7" fill={P.metal} />
        <Rect x="69" y="43" width="16" height="34" rx="7" fill={P.metal} />
        <Path d="M18 78l5 13 5-13M72 78l5 13 5-13" fill={P.hatOrange} />
      </G>
    );
  }
  if (id === 'acc-backpack') {
    return <Rect x="7" y="49" width="25" height="34" rx="10" fill={P.hatPurple} />;
  }
  return null;
}

function renderHat(id: string | undefined): ReactNode {
  if (!id) return null;
  if (id === 'hat-casquette') {
    return (
      <G>
        <Path d="M28 25c8-10 29-13 43-1l-5 16H30l-2-15z" fill={P.hatBlue} />
        <Path d="M59 36c16-1 25 4 28 11-11 3-22 1-31-5l3-6z" fill={P.hatDeep} />
        <Path d="M32 27c8 5 22 6 34 1" stroke={P.lens} strokeWidth="4" strokeLinecap="round" />
      </G>
    );
  }
  if (id === 'hat-block-crown') {
    return <Path d="M26 31l8-17 13 12 8-18 12 18 11-12 4 17H26z" fill={P.block} stroke={P.hatOrange} strokeWidth="3" />;
  }
  if (id === 'hat-panama') {
    return (
      <G>
        <Ellipse cx="50" cy="35" rx="35" ry="9" fill={P.furLight} />
        <Path d="M32 34c1-17 8-24 18-24s17 7 18 24H32z" fill={P.furLight} />
        <Path d="M34 27h32" stroke={P.hatOrange} strokeWidth="6" strokeLinecap="round" />
      </G>
    );
  }
  if (id === 'hat-beanie') {
    return (
      <G>
        <Circle cx="50" cy="13" r="7" fill={P.auraPink} />
        <Path d="M26 36c3-18 13-27 24-27s21 9 24 27H26z" fill={P.hatPurple} />
        <Path d="M29 35h42" stroke={P.auraPink} strokeWidth="8" strokeLinecap="round" />
      </G>
    );
  }
  if (id === 'hat-tophat') {
    return (
      <G>
        <Rect x="35" y="9" width="30" height="34" rx="5" fill={P.hatDeep} />
        <Rect x="29" y="35" width="42" height="10" rx="5" fill={P.hatDeep} />
        <Rect x="35" y="29" width="30" height="7" fill={P.block} />
      </G>
    );
  }
  if (id === 'hat-halo') {
    return <Ellipse cx="50" cy="22" rx="28" ry="8" stroke={P.block} strokeWidth="6" />;
  }
  return null;
}

function renderFace(id: string | undefined): ReactNode {
  if (!id) return null;
  if (id === 'face-glasses' || id === 'face-sunglasses') {
    const fill = id === 'face-sunglasses' ? P.glasses : P.lens;
    const opacity = id === 'face-sunglasses' ? 0.95 : 0.42;
    return (
      <G>
        <Rect x="26" y="40" width="20" height="14" rx="6" fill={fill} opacity={opacity} stroke={P.glasses} strokeWidth="4" />
        <Rect x="54" y="40" width="20" height="14" rx="6" fill={fill} opacity={opacity} stroke={P.glasses} strokeWidth="4" />
        <Line x1="46" y1="47" x2="54" y2="47" stroke={P.glasses} strokeWidth="4" strokeLinecap="round" />
      </G>
    );
  }
  if (id === 'face-star-eyes') {
    return (
      <G>
        <Star cx={36} cy={46} r={9} fill={P.block} />
        <Star cx={64} cy={46} r={9} fill={P.block} />
      </G>
    );
  }
  if (id === 'face-monocle') {
    return (
      <G>
        <Circle cx="64" cy="47" r="11" fill={P.lens} opacity="0.35" stroke={P.block} strokeWidth="4" />
        <Path d="M73 55c6 7 8 14 4 20" stroke={P.block} strokeWidth="3" strokeLinecap="round" />
      </G>
    );
  }
  if (id === 'face-vr-visor') {
    return (
      <G>
        <Rect x="23" y="37" width="54" height="22" rx="10" fill={P.hatDeep} />
        <Path d="M31 47c11-6 27-6 38 0" stroke={P.auraBlue} strokeWidth="5" strokeLinecap="round" />
      </G>
    );
  }
  return null;
}

function renderAccessoryFront(id: string | undefined): ReactNode {
  if (!id) return null;
  if (id === 'acc-headphones') {
    return (
      <G>
        <Path d="M25 45c0-22 50-22 50 0" stroke={P.hatDeep} strokeWidth="7" strokeLinecap="round" />
        <Rect x="16" y="43" width="17" height="24" rx="7" fill={P.hatDeep} />
        <Rect x="67" y="43" width="17" height="24" rx="7" fill={P.hatDeep} />
        <Rect x="20" y="49" width="9" height="13" rx="4" fill={P.accessoryTeal} />
        <Rect x="71" y="49" width="9" height="13" rx="4" fill={P.accessoryTeal} />
      </G>
    );
  }
  if (id === 'acc-scarf') {
    return (
      <G>
        <Path d="M24 70c16 8 36 8 52 0v12c-19 8-35 8-52 0V70z" fill={P.scarf} />
        <Path d="M60 74l18 19 7-12-17-10-8 3z" fill={P.hatOrange} />
      </G>
    );
  }
  if (id === 'acc-backpack') {
    return <Path d="M24 52c10 3 15 12 14 27" stroke={P.block} strokeWidth="5" strokeLinecap="round" />;
  }
  return null;
}

function BlockMark({ stage }: { stage: Stage }) {
  const color = stage >= 3 ? P.accessoryTeal : P.block;
  return (
    <G>
      <Rect x="43" y="18" width="14" height="14" rx="3" fill={color} />
      {stage >= 3 ? <Rect x="59" y="22" width="10" height="10" rx="2" fill={P.block} /> : null}
    </G>
  );
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return (
    <Polygon
      points={`${cx},${cy - r} ${cx + r * 0.28},${cy - r * 0.28} ${cx + r},${cy} ${cx + r * 0.28},${cy + r * 0.28} ${cx},${cy + r} ${cx - r * 0.28},${cy + r * 0.28} ${cx - r},${cy} ${cx - r * 0.28},${cy - r * 0.28}`}
      fill={fill}
    />
  );
}

const styles = StyleSheet.create({
  eyeRow: {
    position: 'absolute',
    top: '41%',
    left: '27%',
    right: '27%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eye: {
    width: 11,
    height: 13,
    borderRadius: 7,
    backgroundColor: P.ink,
  },
  eyeSpark: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: P.eyeSpark,
  },
});
