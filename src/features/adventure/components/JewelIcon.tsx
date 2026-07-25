import { Image } from 'react-native';

import { MINERAL_ASSETS, type MineralAssetId } from '../assets';

interface Props {
  size?: number;
  mineral?: MineralAssetId;
}

export function JewelIcon({ size = 18, mineral = 'diamond' }: Props) {
  return (
    <Image
      source={MINERAL_ASSETS[mineral]}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
