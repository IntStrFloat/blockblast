import type { AnalyticsEventMap } from '@/features/analytics/types';
import { MONETIZATION } from './config';

export const AD_POLICY_VERSION = MONETIZATION.placementPolicy.version;
type Revenue = AnalyticsEventMap['ad_revenue'];
type RevenueContext = Pick<Revenue, 'format' | 'placement' | 'attempt_id' | 'ad_unit_id'>;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    ? value
    : undefined;
}

function amount(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value))) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Android8.3 banner bridge emits {rawData}, despite its published string type. */
export function bannerImpressionRawData(data: unknown): unknown {
  return data && typeof data === 'object' && 'rawData' in data
    ? data.rawData
    : data;
}

/** SDK8 fullscreen rawData / banner impressionData, strictly allowlisted. */
export function parseImpressionRevenue(raw: unknown, context: RevenueContext): Revenue | null {
  if (typeof raw !== 'string') return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const fields = data as Record<string, unknown>;
    const revenue = amount(fields.revenue);
    const currency = text(fields.currency);
    if (revenue === undefined || !currency || !/^[A-Z]{3}$/.test(currency)) return null;
    const network = fields.network && typeof fields.network === 'object'
      ? fields.network as Record<string, unknown>
      : {};
    return {
      ...context,
      policy_version: AD_POLICY_VERSION,
      revenue,
      currency,
      ad_unit_id: text(fields.ad_unit_id) ?? context.ad_unit_id,
      revenue_usd: amount(fields.revenueUSD),
      precision: text(fields.precision),
      network: text(network.name),
      network_ad_unit_id: text(network.ad_unit_id),
      impression_id: text(fields.impression_id),
    };
  } catch {
    return null;
  }
}

/** Banner refreshes can have identical amounts. Only provider IDs prove duplication. */
export function acceptBannerRevenue(event: Revenue | null, seen: Set<string>): boolean {
  if (!event) return false;
  if (!event.impression_id) return true;
  if (seen.has(event.impression_id)) return false;
  seen.add(event.impression_id);
  if (seen.size > 128) seen.delete(seen.values().next().value!);
  return true;
}
