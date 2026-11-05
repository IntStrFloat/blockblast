import { acceptBannerRevenue, bannerImpressionRawData, parseImpressionRevenue } from '../revenue';

const context = { format: 'banner' as const, placement: 'game', attempt_id: 'attempt', ad_unit_id: 'configured-unit' };

describe('SDK impression revenue', () => {
  it('accepts the actual Android banner map and the wrapper-declared string shape', () => {
    const rawData = '{"revenue":"0.0123","currency":"RUB"}';
    expect(parseImpressionRevenue(bannerImpressionRawData({ rawData }), context)?.revenue).toBe(0.0123);
    expect(parseImpressionRevenue(bannerImpressionRawData(rawData), context)?.revenue).toBe(0.0123);
    expect(parseImpressionRevenue(bannerImpressionRawData(undefined), context)).toBeNull();
  });
  it('allowlists real amounts, currency, precision and network metadata without copying personal/raw fields', () => {
    const event = parseImpressionRevenue(JSON.stringify({
      revenue: '0.0123', currency: 'RUB', revenueUSD: '0.00014', precision: 'estimated',
      ad_unit_id: 'provider-unit', network: { name: 'Yandex', ad_unit_id: 'network-unit' },
      email: 'private@example.org', device_id: 'private',
    }), context);
    expect(event).toEqual({
      ...context, ad_unit_id: 'provider-unit', revenue: 0.0123, currency: 'RUB',
      revenue_usd: 0.00014, precision: 'estimated', network: 'Yandex', network_ad_unit_id: 'network-unit',
      policy_version: 'contextual-breaks-v3-decline-without-cooldown', impression_id: undefined,
    });
  });

  it.each([undefined, '', 'broken', '{}', 'null', '[]', '{"revenue":null,"currency":"RUB"}',
    '{"revenue":"","currency":"RUB"}', '{"revenue":"NaN","currency":"RUB"}',
    '{"revenue":-1,"currency":"RUB"}', '{"revenue":"1e999","currency":"RUB"}',
    '{"revenue":1,"currency":""}', '{"revenue":true,"currency":"RUB"}',
  ])('does not synthesize revenue from invalid/missing payload: %s', (raw) => {
    expect(parseImpressionRevenue(raw, context)).toBeNull();
  });

  it('preserves genuine zero and does not mistake USD for original-currency revenue', () => {
    expect(parseImpressionRevenue('{"revenue":"0","currency":"RUB"}', context)?.revenue).toBe(0);
    expect(parseImpressionRevenue('{"revenueUSD":"1","currency":"RUB"}', context)).toBeNull();
  });

  it('retains identical banner refresh amounts but deduplicates explicit provider IDs', () => {
    const seen = new Set<string>();
    const refresh = parseImpressionRevenue('{"revenue":"0.1","currency":"RUB"}', context);
    expect(acceptBannerRevenue(refresh, seen)).toBe(true);
    expect(acceptBannerRevenue(refresh, seen)).toBe(true);
    const identified = parseImpressionRevenue('{"revenue":"0.1","currency":"RUB","impression_id":"provider-1"}', context);
    expect(acceptBannerRevenue(identified, seen)).toBe(true);
    expect(acceptBannerRevenue(identified, seen)).toBe(false);
    expect(acceptBannerRevenue({ ...identified!, impression_id: 'provider-2' }, seen)).toBe(true);
  });
});
