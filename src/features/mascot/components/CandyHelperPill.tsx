import { Pressable, View } from 'react-native';
import { AppText, CandyIcon, nightCandy as n } from '@/ui';

export function CandyHelperPill({
  helper,
  label,
  count,
  disabled,
  onPress,
  rewarded = false,
}: {
  helper: 'hint' | 'swap';
  label: string;
  count: number;
  disabled: boolean;
  onPress: () => void;
  rewarded?: boolean;
}) {
  const color = helper === 'hint' ? n.sun : n.sky;
  return (
    <Pressable
      testID={`helper-${helper}`}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${rewarded ? 'Реклама' : count}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 99,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.22)',
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      <CandyIcon name={helper === 'hint' ? 'bulb' : 'swap'} size={20} color={color} />
      <AppText
        style={{ fontFamily: 'Nunito_900Black', fontSize: 14, lineHeight: 20, flexShrink: 1 }}
      >
        {label}
      </AppText>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {rewarded ? (
          <CandyIcon name="play" size={12} color={n.sunInk} />
        ) : (
          <AppText preset="button" style={{ color: n.sunInk, fontSize: 12, lineHeight: 16 }}>
            {count}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}
