import {
  createLeaderboardClient,
  createRemoteLeaderboardClient,
  hasRemoteLeaderboardConfig,
} from '../client';

describe('leaderboard client adapters', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalApiKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalApiKey;
  });

  it('falls back to the local adapter when API url is absent', () => {
    const client = createLeaderboardClient();
    expect(client.kind).toBe('local');
    expect(hasRemoteLeaderboardConfig()).toBe(false);
  });

  it('bootstrap sends nickname only and receives the server-owned tag', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://example.com';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-key';
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: { nickname: 'LimeComet', tag: 'SRV' },
        authToken: 'token-123',
      }),
    });

    const client = createRemoteLeaderboardClient('https://example.com');
    const session = await client.bootstrapProfile({
      nickname: 'LimeComet',
      authToken: 'existing-token',
    });

    expect(session.profile.tag).toBe('SRV');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/api/profile/bootstrap',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer existing-token',
          'X-API-Key': 'public-key',
        }),
        body: JSON.stringify({ nickname: 'LimeComet' }),
      }),
    );
  });

  it('rename sends nickname only and submit sends ticket id', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://example.com';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-key';
    (globalThis.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { nickname: 'PixelHero', tag: 'SRV' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ impact: { score: 1200, weeklyBest: 1200, rank: 8, rankDelta: 1, improved: true, queued: false } }),
      });

    const client = createRemoteLeaderboardClient('https://example.com');
    await client.renameProfile({ authToken: 'token-123', nickname: 'PixelHero' });
    await client.submitRun({
      authToken: 'token-123',
      ticketId: 'ticket-7',
      score: 1200,
      seed: 500,
      moves: [{ trayIndex: 0, row: 0, col: 0 }],
      durationMs: 120000,
    });

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://example.com/api/profile/rename',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'X-API-Key': 'public-key',
        }),
        body: JSON.stringify({ nickname: 'PixelHero' }),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'https://example.com/api/runs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          ticketId: 'ticket-7',
          score: 1200,
          seed: 500,
          moves: [{ trayIndex: 0, row: 0, col: 0 }],
          durationMs: 120000,
        }),
      }),
    );
  });

  it('issues tickets through the remote endpoint', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://example.com';
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        tickets: [{ ticketId: 'ticket-1', seed: 501, expiresAt: '2026-06-20T00:00:00.000Z' }],
      }),
    });

    const client = createRemoteLeaderboardClient('https://example.com');
    const tickets = await client.issueTickets({ authToken: 'token-123' });

    expect(tickets).toEqual([
      { ticketId: 'ticket-1', seed: 501, expiresAt: '2026-06-20T00:00:00.000Z' },
    ]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/api/tickets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    );
  });
});
