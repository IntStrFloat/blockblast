declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const layoutSource = fs.readFileSync(`${__dirname}/../_layout.tsx`, 'utf8');
const startupIntentSource = fs.readFileSync(
  `${__dirname}/../../features/notifications/startupIntent.ts`,
  'utf8',
);

describe('root layout analytics lifecycle', () => {
  it('resolves the cold-start intent before creating the first analytics session', () => {
    expect(layoutSource).toContain('getInitialSessionIntent().then');
    expect(startupIntentSource).toContain('initialSessionIntentPromise');
    expect(startupIntentSource).toContain('push.getInitialNotificationTap()');
    expect(startupIntentSource).toContain('Notifications.getLastNotificationResponseAsync()');
    expect(startupIntentSource).toContain('Linking.getInitialURL()');
    expect(startupIntentSource).toContain(
      "if (remoteTap) return { source: 'notification', remoteTap, localTap: null };",
    );
    expect(startupIntentSource).toContain(
      "if (initialUrl) return { source: 'deeplink', remoteTap: null, localTap: null };",
    );
    expect(startupIntentSource).toContain(
      "return { source: 'organic', remoteTap: null, localTap: null };",
    );
    expect(layoutSource).toContain('entrySource,');
    expect(layoutSource).toContain('resolveProductSession({');
    expect(layoutSource).toContain('initializeInterstitialExperiment(resolution.context)');
  });

  it('resumes short pauses and creates a frozen context only at a product-session boundary', () => {
    expect(layoutSource).toContain('const appStateRef = useRef(AppState.currentState);');
    expect(layoutSource).toContain(
      'const resolution = resolveProductSession({',
    );
    expect(layoutSource).toContain("analytics.track('session_started', {});");
    expect(layoutSource).toContain('analytics.endSession();');
    expect(layoutSource).toContain("analytics.track('session_resumed'");
    expect(layoutSource).toContain(
      "if (previousState !== 'active') schedulePendingSession();",
    );
    expect(layoutSource).toContain('WARM_ENTRY_SETTLE_MS');
  });

  it('pauses run and product session while AppMetrica keeps automatic SDK sessions', () => {
    expect(layoutSource).toContain("if (nextState !== 'active') {");
    expect(layoutSource).toContain('analytics.flush();');
    expect(layoutSource).toContain('analytics.pauseRun();');
    expect(layoutSource).not.toContain('analytics.pauseSdkSession();');
    expect(layoutSource).not.toContain('analytics.resumeSdkSession();');
    expect(layoutSource).toContain('pauseProductSession(Date.now());');
    expect(layoutSource).toContain('lifetimeGames: useScores.getState().gamesPlayed');
  });

  it('keeps push origin separate from notification kind', () => {
    expect(layoutSource).toContain("origin: 'remote'");
    expect(layoutSource).toContain("markPendingEntrySource('notification')");
    expect(layoutSource).toContain('shouldHandleRemoteTap(tap, remoteTapDedupeRef.current)');
    expect(layoutSource).toContain('pendingNotificationRouteRef');
    expect(layoutSource).toContain('useLocalNotifications(fontsLoaded)');
  });

  it('starts a fresh product session when analytics is opted back in', () => {
    expect(layoutSource).toContain('const analyticsOptOut = useAnalyticsStore');
    expect(layoutSource).toContain('if (analyticsOptOut || !initialIntentResolvedRef.current) return;');
    expect(layoutSource).toContain('schedulePendingSession();');
  });
});
