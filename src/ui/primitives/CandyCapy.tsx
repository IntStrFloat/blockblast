import { useId } from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, {
  Defs,
  Filter,
  FeColorMatrix,
  Image as SvgImage,
} from 'react-native-svg';
import { AppText } from '../AppText';
import { nightCandy as n } from '../nightCandy';

export function CandyCapy({
  size = 84,
  skin,
}: {
  size?: number;
  skin?: string;
}) {
  const filterId = `capySkin${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (skin) {
    const type =
      skin === 'skin-chrome'
        ? 'saturate'
        : skin === 'skin-obsidian'
          ? 'matrix'
          : 'hueRotate';
    const values =
      skin === 'skin-chrome'
        ? '0'
        : skin === 'skin-obsidian'
          ? '.12 .18 .04 0 .02 .12 .18 .04 0 .02 .18 .24 .08 0 .04 0 0 0 1 0'
          : skin === 'skin-mint'
            ? '115'
            : '-40';
    return (
      <Svg
        width={size}
        height={size}
        accessibilityLabel="Капи"
        viewBox="0 0 100 100"
      >
        <Defs>
          <Filter id={filterId}>
            <FeColorMatrix type={type} values={values} />
          </Filter>
        </Defs>
        <SvgImage
          href={require('../../../assets/night-candy/capy.png')}
          width={100}
          height={100}
          preserveAspectRatio="xMidYMid meet"
          filter={`url(#${filterId})`}
        />
      </Svg>
    );
  }
  return (
    <Image
      source={require('../../../assets/night-candy/capy.png')}
      accessibilityLabel="Капи"
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export function CandyAvatar({
  rank,
  onPress,
  size = 48,
}: {
  rank: number;
  onPress?: () => void;
  size?: number;
}) {
  const art = (
    <>
      <CandyCapy size={size - 8} />
      <View
        style={{
          position: 'absolute',
          right: -6,
          bottom: -6,
          minWidth: 22,
          height: 22,
          paddingHorizontal: 4,
          borderRadius: 99,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: n.grape,
        }}
      >
        <AppText
          preset="button"
          style={{ fontSize: 11, lineHeight: 16, color: '#1E0A4D' }}
        >
          {rank}
        </AppText>
      </View>
    </>
  );
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: n.grape,
    backgroundColor: n.night700,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Капи, ранг ${rank}`}
      onPress={onPress}
      style={style}
    >
      {art}
    </Pressable>
  ) : (
    <View style={style}>{art}</View>
  );
}
