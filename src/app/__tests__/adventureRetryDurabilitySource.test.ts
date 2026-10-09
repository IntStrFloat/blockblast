declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../adventure-level.tsx`, 'utf8');

describe('Adventure retry durability boundary', () => {
  it('persists accept/decline before analytics and the interstitial async boundary', () => {
    const handler = source.slice(
      source.indexOf('const retryFailedLevel'),
      source.indexOf('const overlayBlocksPlayfield'),
    );
    const persist = handler.indexOf('setAdventureRetryPolicy(run.runId, policy)');
    const analytics = handler.indexOf("track('adventure_retry_decision'");
    const externalAsync = handler.indexOf("runAfterInterstitial('adventure_fail'");
    expect(persist).toBeGreaterThanOrEqual(0);
    expect(persist).toBeLessThan(analytics);
    expect(analytics).toBeLessThan(externalAsync);
  });
});
