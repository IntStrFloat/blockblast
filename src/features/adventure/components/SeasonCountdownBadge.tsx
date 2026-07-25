import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useProfileStore } from '@/features/profile';
import { AppText } from '@/ui';

import { adventureSeasonRemainingMs, formatAdventureSeasonRemaining } from '../logic/seasonWindow';
import { useAdventure } from '../store';

interface Props {
  compact?: boolean;
  short?: boolean;
  variant?: 'default' | 'ribbon';
}

export function SeasonCountdownBadge({ compact = false, short = false, variant = 'default' }: Props) {
  const seasonWindow = useAdventure((s) => s.seasonWindow);
  const syncedAtMs = useAdventure((s) => s.seasonWindowSyncedAtMs);
  const syncStatus = useAdventure((s) => s.syncStatus);
  const syncSeasonWindow = useAdventure((s) => s.syncSeasonWindow);
  const authToken = useProfileStore((s) => s.authToken);
  const bootstrapRemote = useProfileStore((s) => s.bootstrapRemote);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Бейдж сам добывает окно сезона: на Home экраны adventure не монтируются,
  // и без этого запроса «Обновляем время» висело бы вечно.
  useEffect(() => {
    if (seasonWindow || syncStatus !== 'idle') return;
    let active = true;
    void (async () => {
      const token = authToken ?? (await bootstrapRemote())?.authToken ?? null;
      if (active && token) await syncSeasonWindow(token);
    })();
    return () => {
      active = false;
    };
  }, [authToken, bootstrapRemote, seasonWindow, syncSeasonWindow, syncStatus]);

  const label = useMemo(() => {
    if (!seasonWindow && syncStatus === 'error') return 'Не удалось обновить время';
    return formatAdventureSeasonRemaining(
      adventureSeasonRemainingMs(seasonWindow, syncedAtMs, nowMs),
    );
  }, [nowMs, seasonWindow, syncedAtMs, syncStatus]);
  const isRibbon = variant === 'ribbon';
  const displayedLabel = short ? label.replace('Осталось ', '') : label;

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
          fontFamily: isRibbon ? 'Fredoka_700Bold' : undefined,
          fontSize: isRibbon ? 11 : compact ? 12 : 13,
          textAlign: 'center',
        }}
      >
        {displayedLabel}
      </AppText>
    </View>
  );
}
