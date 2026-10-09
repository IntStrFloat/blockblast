import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useLang } from '@/features/settings';
import { AppText } from '@/ui';

import { adventureSeasonRemainingMs, formatAdventureSeasonRemaining } from '../logic/seasonWindow';
import { useSeasonWindowRefresh } from '../hooks/useSeasonWindowRefresh';
import { useAdventure } from '../store';

interface Props {
  compact?: boolean;
  short?: boolean;
  variant?: 'default' | 'ribbon';
  autoRefresh?: boolean;
}

export function SeasonCountdownBadge({
  compact = false,
  short = false,
  variant = 'default',
  autoRefresh = true,
}: Props) {
  const seasonWindow = useAdventure((s) => s.seasonWindow);
  const syncedAtMs = useAdventure((s) => s.seasonWindowSyncedAtMs);
  const lang = useLang();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useSeasonWindowRefresh(autoRefresh);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const label = useMemo(() => {
    return formatAdventureSeasonRemaining(
      adventureSeasonRemainingMs(seasonWindow, syncedAtMs, nowMs),
      lang,
      short,
    );
  }, [lang, nowMs, seasonWindow, short, syncedAtMs]);
  const isRibbon = variant === 'ribbon';

  return (
    <View
      style={{
        alignSelf: compact ? 'flex-start' : 'center',
        maxWidth: '92%',
        // В хедере (non-compact) чип — «утопленный» слот из синей семьи шапки:
        // глубокий сине-навигационный фон + светлый волосок сверху под цвет титула,
        // чтобы читался как часть хедера, а не тёмное инородное пятно.
        backgroundColor: isRibbon ? 'transparent' : compact ? 'rgba(255,255,255,0.13)' : 'rgba(18,33,84,0.42)',
        borderRadius: 999,
        paddingHorizontal: isRibbon ? 0 : compact ? 9 : 13,
        paddingVertical: isRibbon ? 0 : compact ? 4 : 5,
        borderWidth: isRibbon ? 0 : 1,
        borderColor: compact ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.30)',
      }}
    >
      <AppText
        preset="caption"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{
          color: isRibbon ? '#FFFFFF' : compact ? '#F8FCFF' : '#EFF5FF',
          fontFamily: isRibbon ? 'Unbounded_700Bold' : undefined,
          fontSize: isRibbon ? 11 : compact ? 12 : 13,
          textAlign: 'center',
        }}
      >
        {label}
      </AppText>
    </View>
  );
}
