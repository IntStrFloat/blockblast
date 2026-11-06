import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMascot } from '@/features/mascot/store';
import { useLang } from '@/features/settings';
import { AppText } from '../AppText';
import { CandyIcon } from '../icons/CandyIcon';
import { nightCandy as n } from '../nightCandy';

export type BottomNavTab = 'play' | 'adventure' | 'capy' | 'rating';
const tabs = [
  { id: 'play', label: 'Играть', en: 'Play', icon: 'play', route: '/' },
  {
    id: 'adventure',
    label: 'Приключение',
    en: 'Adventure',
    icon: 'map',
    route: '/adventure',
  },
  { id: 'capy', label: 'Капи', en: 'Capy', icon: 'wardrobe', route: '/capy' },
  {
    id: 'rating',
    label: 'Рейтинг',
    en: 'Rating',
    icon: 'rating',
    route: '/leaderboard',
  },
] as const;

export function BottomNav({
  active,
  onChange,
}: {
  active: BottomNavTab;
  onChange?: (tab: BottomNavTab) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const unread = useMascot((s) =>
    s.unlocked.some(
      (id) =>
        !(s.wornCosmetics ?? []).includes(id) &&
        !Object.values(s.equipped).includes(id),
    ),
  );
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: Math.max(12, insets.bottom),
        backgroundColor: '#0C1044',
        borderTopWidth: 1.5,
        borderTopColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              if (selected) return;
              if (onChange) onChange(tab.id);
              else router.navigate(tab.route);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={lang === 'ru' ? tab.label : tab.en}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', gap: 4 }}
          >
            <View
              style={{
                width: 56,
                height: 32,
                borderRadius: 99,
                backgroundColor: selected ? n.sun : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CandyIcon
                name={tab.icon}
                size={22}
                color={selected ? n.sunInk : n.muted}
              />
              {tab.id === 'capy' && unread ? (
                <View
                  accessibilityLabel={
                    lang === 'ru' ? 'Новые предметы' : 'New items'
                  }
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: 10,
                    width: 10,
                    height: 10,
                    borderRadius: 99,
                    backgroundColor: n.grape,
                    borderWidth: 2,
                    borderColor: '#0C1044',
                  }}
                />
              ) : null}
            </View>
            <AppText
              style={{
                fontFamily: 'Nunito_800ExtraBold',
                color: selected ? n.sun : n.muted,
                fontSize: 12,
                lineHeight: 18,
              }}
              numberOfLines={1}
            >
              {lang === 'ru' ? tab.label : tab.en}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
