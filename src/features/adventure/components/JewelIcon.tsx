import { Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MINERAL_ASSETS, type MineralAssetId } from '../assets';

/** The blue crystal silhouette from the supplied HTML, shared by counters and flights. */
export function JewelIcon({
  size = 18,
  mineral = 'diamond',
}: {
  size?: number;
  mineral?: MineralAssetId;
}) {
  if (mineral !== 'diamond')
    return (
      <Image
        source={MINERAL_ASSETS[mineral]}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    );
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M8 3h16l7 9-15 18L1 12z" fill="#2464F3" />
      <Path
        d="M8 3l4 9H1M24 3l-4 9h11M12 12l4 18 4-18M8 3h16M1 12h30"
        stroke="#78D2FF"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path d="M13 3l-1 9M19 3l1 9" stroke="#A5E5FF" strokeWidth={2} />
    </Svg>
  );
}
