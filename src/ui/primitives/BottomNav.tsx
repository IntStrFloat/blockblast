import { Pressable, View } from 'react-native';

import { AppText } from '../AppText';
import { colors, spacing } from '../theme';

export type BottomNavTab = 'today' | 'path' | 'league' | 'capi';

const tabs: { id: BottomNavTab; label: string; glyph: string }[] = [
  { id: 'today', label: 'Сегодня', glyph: '⌂' },
  { id: 'path', label: 'Путь', glyph: '◇' },
  { id: 'league', label: 'Лига', glyph: '♛' },
  { id: 'capi', label: 'Капи', glyph: '●' },
];

export function BottomNav({ active, onChange }: { active: BottomNavTab; onChange: (tab: BottomNavTab) => void }) {
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: spacing.s, paddingTop: 8, paddingBottom: 6, backgroundColor: 'rgba(15,27,51,0.96)', borderTopWidth: 1, borderTopColor: colors.hairline }}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable key={tab.id} onPress={() => onChange(tab.id)} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 14, backgroundColor: selected ? 'rgba(255,201,60,0.14)' : 'transparent' }}>
            <AppText preset="button" style={{ fontSize: 18, color: selected ? colors.accent : colors.textDim }}>{tab.glyph}</AppText>
            <AppText preset="caption" style={{ color: selected ? colors.accent : colors.textDim, fontSize: 12 }}>{tab.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
