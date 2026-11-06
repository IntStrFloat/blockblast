import Svg, { Circle, Path } from 'react-native-svg';

/** Paths copied from the supplied HTML; no platform-dependent glyph icons. */
const paths = {
  play: ['M8 5v14l11-7z'],
  map: [
    'M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z',
    'M9 4.5v12.7M15 6.8v12.7',
  ],
  wardrobe: [
    'M12 8a2.2 2.2 0 1 1 2.2-2.2c0 1.3-2.2 1.6-2.2 2.9l8.6 6.2c.9.6.5 1.6-.5 1.6H4c-1 0-1.4-1-.5-1.6L12 8.7',
  ],
  rating: ['M3 20.5V14h6v6.5M9 20.5V9h6v11.5M15 20.5v-4.5h6v4.5M2 20.5h20'],
  crown: ['M3 8l4.5 4 4.5-7 4.5 7L21 8l-2 11H5z'],
  fire: [
    'M12 3c1 4 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.5-4.3 2.6-5.3.4 2 1.4 3.2 2.6 3.2 0-3.2-1-5.4.3-8.4z',
  ],
  gear: [
    'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  ],
  infinity: [
    'M7.2 15.5a3.5 3.5 0 1 1 0-7c3.1 0 6.5 7 9.6 7a3.5 3.5 0 1 0 0-7c-3.1 0-6.5 7-9.6 7z',
  ],
  gem: [
    'M7 4.5h10l4 5L12 20 3 9.5z',
    'M3 9.5h18M9.5 4.5L8 9.5l4 10.5 4-10.5-1.5-5',
  ],
  back: ['M14.5 5l-7 7 7 7'],
  pause: ['M8.5 5v14M15.5 5v14'],
  sound: ['M11 4L6 8H3v8h3l5 4z', 'M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14'],
  vibration: ['M8 4h8v16H8z', 'M4 8l-2 4 2 4M20 8l2 4-2 4'],
  bulb: [
    'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z',
  ],
  swap: ['M4 7h15l-4-4M20 17H5l4 4'],
  check: ['M5 12l4.5 4.5L19 7'],
  close: ['M6 6l12 12M18 6L6 18'],
  edit: ['M4 16.5l-.5 4 4-.5L20 7.5 16.5 4z', 'M14.5 6l3.5 3.5'],
  lock: ['M6 10h12v10H6z', 'M8 10V7a4 4 0 0 1 8 0v3'],
  next: ['M9 5l7 7-7 7'],
  sunburst: [
    'M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3',
  ],
  trophy: [
    'M7 3h10v5a5 5 0 0 1-10 0z',
    'M7 5H3v2a5 5 0 0 0 5 5M17 5h4v2a5 5 0 0 1-5 5M12 13v5M8 18h8M7 21h10',
  ],
  chest: [
    'M4 9h16v11H4z',
    'M4 9V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2M4 13h16M10 12h4v4h-4z',
  ],
  home: ['M3 11l9-8 9 8', 'M5 10v11h5v-7h4v7h5V10'],
  retry: ['M4 10a8 8 0 1 1 0 6', 'M4 4v6h6'],
  share: [
    'M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5',
  ],
  language: [
    'M3 5h12M9 3v2M6 5c0 6 4 10 8 11M13 5c-1 5-4 9-10 12M15 21l4-10 4 10M16.5 18h5',
  ],
  flag: ['M5 21V4h12l-2 4 2 4H5'],
  bell: ['M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z', 'M10 21h4'],
  chart: ['M4 20V11M12 20V4M20 20v-6'],
} as const;

export type CandyIconName = keyof typeof paths;
export function CandyIcon({
  name,
  size = 24,
  color = '#FFFFFF',
  filled,
}: {
  name: CandyIconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const fill =
    filled ?? (name === 'play' || name === 'crown' || name === 'fire');
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? color : 'none'}
      stroke={color}
      strokeWidth={name === 'crown' ? 2.2 : 2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name].map((d) => (
        <Path key={d} d={d} />
      ))}
      {name === 'gear' && (
        <>
          <Circle cx={12} cy={12} r={3} />
          <Circle cx={12} cy={12} r={6.5} />
        </>
      )}
    </Svg>
  );
}
