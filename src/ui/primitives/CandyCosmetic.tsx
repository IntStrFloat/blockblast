import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, G } from 'react-native-svg';
import { CosmeticIcon } from '@/features/mascot/components/MascotArt';
import type { Slot } from '@/features/mascot/logic/types';
import { CandyCapy } from './CandyCapy';

/** The authored collectible silhouettes use the original HTML paths. */
export function CandyCosmetic({
  id,
  size = 48,
  muted = false,
}: {
  id: string;
  size?: number;
  muted?: boolean;
}) {
  let art;
  switch (id) {
    case 'hat-casquette':
      art = (
        <>
          <Path d="M8 30c0-10 7-17 16-17s16 7 16 17z" fill="#42B4FF" />
          <Path d="M24 30h20c0 3-3 5-6 5H24z" fill="#1C7FD0" />
          <Circle cx={24} cy={13} r={2.5} fill="#1C7FD0" />
        </>
      );
      break;
    case 'hat-beanie':
      art = (
        <>
          <Path d="M10 32c0-12 6-19 14-19s14 7 14 19z" fill="#9C6BFF" />
          <Rect x={8} y={30} width={32} height={7} rx={3.5} fill="#6E45D6" />
          <Circle cx={24} cy={11} r={4} fill="#FFFFFF" />
        </>
      );
      break;
    case 'hat-panama':
      art = (
        <>
          <Ellipse cx={24} cy={31} rx={20} ry={6} fill="#FFB65C" />
          <Path d="M14 30c0-9 4-15 10-15s10 6 10 15z" fill="#FFD43F" />
          <Rect x={14} y={25} width={20} height={4} fill="#FF4F6A" />
        </>
      );
      break;
    case 'hat-block-crown':
      art = (
        <>
          <Path d="M8 34l2-18 8 8 6-11 6 11 8-8 2 18z" fill="#FFD43F" />
          <Rect x={8} y={33} width={32} height={5} rx={2} fill="#D99A00" />
        </>
      );
      break;
    case 'face-glasses':
      art = (
        <>
          <Circle
            cx={15}
            cy={26}
            r={8}
            fill="#0F1348"
            stroke="#FFD43F"
            strokeWidth={3}
          />
          <Circle
            cx={33}
            cy={26}
            r={8}
            fill="#0F1348"
            stroke="#FFD43F"
            strokeWidth={3}
          />
          <Path d="M23 25h2" stroke="#FFD43F" strokeWidth={3} />
          <Path
            d="M11 23l3-3M29 23l3-3"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'acc-headphones':
      art = (
        <>
          <Path
            d="M10 30v-4a14 14 0 0 1 28 0v4"
            fill="none"
            stroke="#3FDB85"
            strokeWidth={4}
          />
          <Rect x={6} y={27} width={9} height={13} rx={4} fill="#3FDB85" />
          <Rect x={33} y={27} width={9} height={13} rx={4} fill="#3FDB85" />
        </>
      );
      break;
    case 'acc-scarf':
      art = (
        <>
          <Path d="M8 17c10 6 22 6 32 0v9c-10 6-22 6-32 0z" fill="#FF4F6A" />
          <Path d="M27 26l5 16h-7l-3-15z" fill="#FF6FCF" />
        </>
      );
      break;
    case 'hat-tophat':
      art = (
        <>
          <Rect x={13} y={7} width={22} height={27} rx={4} fill="#232C88" />
          <Rect x={13} y={26} width={22} height={6} fill="#FF4F6A" />
          <Ellipse cx={24} cy={35} rx={20} ry={5} fill="#1A2170" />
          <Path
            d="M17 12v11"
            stroke="#A47BFF"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'hat-halo':
      art = (
        <>
          <Ellipse
            cx={24}
            cy={21}
            rx={19}
            ry={6}
            fill="none"
            stroke="#FFC93C"
            strokeWidth={5}
          />
          <Path
            d="M8 10V4M5 7h6M40 8v6M37 11h6"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'face-sunglasses':
      art = (
        <>
          <Path
            d="M3 19h19l-2 13H8zM26 19h19l-5 13H28z"
            fill="#0B0E2E"
            stroke="#A47BFF"
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M22 23h4M10 22l-3 6M32 22l-3 6"
            stroke="#48BBFF"
            strokeWidth={2}
          />
        </>
      );
      break;
    case 'face-star-eyes':
      art = (
        <>
          <Path
            d="M13 15l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1zM35 15l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"
            fill="#FFD43F"
            stroke="#D99A00"
            strokeWidth={1.5}
          />
        </>
      );
      break;
    case 'face-monocle':
      art = (
        <>
          <Circle
            cx={32}
            cy={23}
            r={10}
            fill="#141A5C"
            stroke="#FFC93C"
            strokeWidth={3}
          />
          <Path
            d="M38 31v7q0 6 5 6M27 21l4-4"
            fill="none"
            stroke="#FFE08A"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'face-vr-visor':
      art = (
        <>
          <Rect x={3} y={14} width={42} height={22} rx={8} fill="#A47BFF" />
          <Rect x={6} y={17} width={36} height={14} rx={5} fill="#141A5C" />
          <Path
            d="M11 21h9M31 21h6"
            stroke="#48BBFF"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Path d="M19 36l5-6 5 6" fill="#141A5C" />
        </>
      );
      break;
    case 'acc-backpack':
      art = (
        <>
          <Rect x={10} y={11} width={28} height={32} rx={9} fill="#FF8A2A" />
          <Path
            d="M18 11V7h12v4M10 20H7v15h3M38 20h3v15h-3"
            fill="none"
            stroke="#C85F0B"
            strokeWidth={3}
          />
          <Rect x={14} y={27} width={20} height={11} rx={4} fill="#FFC93C" />
          <Path d="M18 31h12" stroke="#C85F0B" strokeWidth={2} />
        </>
      );
      break;
    case 'acc-cape':
      art = (
        <>
          <Path d="M15 10h18l11 31c-11-6-29 6-40 0z" fill="#9C6BFF" />
          <Path d="M15 10l9 26 9-26" fill="#6E45D6" />
          <Circle cx={24} cy={12} r={4} fill="#FFC93C" />
        </>
      );
      break;
    case 'acc-jetpack':
      art = (
        <>
          <Rect x={15} y={12} width={18} height={24} rx={5} fill="#9DA6F0" />
          <Rect x={7} y={16} width={10} height={22} rx={5} fill="#48BBFF" />
          <Rect x={31} y={16} width={10} height={22} rx={5} fill="#48BBFF" />
          <Path d="M9 38l3 9 3-9M33 38l3 9 3-9" fill="#FF8A2A" />
          <Circle cx={24} cy={23} r={5} fill="#FFC93C" />
        </>
      );
      break;
    case 'skin-mint':
    case 'skin-coral':
    case 'skin-chrome':
    case 'skin-obsidian':
      return (
        <View style={{ opacity: muted ? 0.3 : 1 }}>
          <CandyCapy size={size} skin={id} />
        </View>
      );
    case 'aura-sparkles':
    case 'aura-stars':
    case 'aura-rainbow':
    case 'aura-fire':
      art = <CandyAuraArt id={id} />;
      break;
    default:
      return <CosmeticIcon id={id} size={size} muted={muted} />;
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      opacity={muted ? 0.3 : 1}
    >
      {art}
    </Svg>
  );
}

export function DressedCandyCapy({
  equipped,
  size = 112,
}: {
  equipped: Partial<Record<Slot, string>>;
  size?: number;
}) {
  const k = size / 112;
  return (
    <View style={{ width: size, height: 120 * k }}>
      {equipped.aura ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: -12 * k, top: -10 * k }}
        >
          <CandyCosmetic id={equipped.aura} size={136 * k} />
        </View>
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: 6 * k,
          right: 6 * k,
          bottom: 0,
          height: 22 * k,
          borderRadius: 99,
          backgroundColor: 'rgba(164,123,255,0.35)',
        }}
      />
      {equipped.accessory &&
      ['acc-backpack', 'acc-cape', 'acc-jetpack'].includes(
        equipped.accessory,
      ) ? (
        <View style={{ position: 'absolute', left: 2 * k, top: 27 * k }}>
          <CandyCosmetic id={equipped.accessory} size={108 * k} />
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 6 * k, top: 18 * k }}>
        <CandyCapy size={100 * k} skin={equipped.skin} />
      </View>
      {equipped.hat && (
        <View style={{ position: 'absolute', left: 22 * k, top: -4 * k }}>
          <CandyCosmetic id={equipped.hat} size={70 * k} />
        </View>
      )}
      {equipped.face && (
        <View style={{ position: 'absolute', left: 24 * k, top: 38 * k }}>
          <CandyCosmetic id={equipped.face} size={64 * k} />
        </View>
      )}
      {equipped.accessory &&
        !['acc-backpack', 'acc-cape', 'acc-jetpack'].includes(
          equipped.accessory,
        ) && (
          <View
            style={{
              position: 'absolute',
              left: 2 * k,
              top: equipped.accessory === 'acc-headphones' ? 10 * k : 60 * k,
            }}
          >
            <CandyCosmetic id={equipped.accessory} size={108 * k} />
          </View>
        )}
    </View>
  );
}

function CandyAuraArt({ id }: { id: string }) {
  if (id === 'aura-rainbow')
    return (
      <>
        {['#FF4F6A', '#FFC93C', '#34E0A1', '#48BBFF', '#A47BFF'].map(
          (color, i) => (
            <Circle
              key={color}
              cx={24}
              cy={24}
              r={21 - i * 2.5}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              opacity={0.65}
            />
          ),
        )}
      </>
    );
  if (id === 'aura-fire')
    return (
      <Path
        d="M9 37C-1 22 14 21 14 10c7 4 6 9 9 11C24 12 31 9 28 2c16 12 11 19 13 21 3 6 6 9 1 17-10 10-25 9-33-3z"
        fill="#FF8A2A"
        opacity={0.8}
      />
    );
  return (
    <>
      {[
        [-1, 0],
        [1, 0],
        [-0.7, -0.7],
        [0.7, -0.7],
        [0, -1],
        [-0.7, 0.7],
        [0.7, 0.7],
      ].map(([dx, dy], i) => (
        <G key={i} transform={`translate(${24 + dx * 19} ${24 + dy * 19})`}>
          <Path
            d={
              id === 'aura-stars'
                ? 'M0-5l1.5 3 3.5.5-2.5 2.4.6 3.5L0 2.8-3.1 4.4l.6-3.5L-5-1.5l3.5-.5z'
                : 'M0-5L1.5-1.5 5 0 1.5 1.5 0 5-1.5 1.5-5 0-1.5-1.5z'
            }
            fill={i % 2 ? '#FFC93C' : '#A47BFF'}
          />
        </G>
      ))}
    </>
  );
}
