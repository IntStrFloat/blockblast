import { KEYS, getJSON, setJSON } from '@/core/storage';

import { useAnalyticsStore } from './store';

interface ExperimentState {
  seed: string;
  assignments: Record<string, string>;
}

export function getExperimentAssignment(experimentId: string): string | null {
  return getJSON<ExperimentState>(KEYS.analyticsExperiments)?.assignments?.[experimentId] ?? null;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function assignExperimentVariant(
  experimentId: string,
  variants: readonly string[],
  seedFactory: () => string = () => `${Date.now()}-${Math.random()}`,
): string {
  if (variants.length === 0) throw new Error('Experiment requires at least one variant');
  const existing = getJSON<ExperimentState>(KEYS.analyticsExperiments);
  const seed = existing?.seed ?? seedFactory();
  const assigned = existing?.assignments?.[experimentId];
  if (assigned && variants.includes(assigned)) return assigned;
  const variant = variants[hash(`${seed}:${experimentId}`) % variants.length]!;
  setJSON(KEYS.analyticsExperiments, {
    seed,
    assignments: { ...(existing?.assignments ?? {}), [experimentId]: variant },
  } satisfies ExperimentState);
  return variant;
}

/** Call only from the branch that actually rendered the changed surface. */
export function recordExperimentExposure(
  experimentId: string,
  variant: string,
  surface: string,
): string | null {
  return useAnalyticsStore.getState().trackOnce(
    `experiment-exposure:${experimentId}:${variant}:${surface}`,
    'experiment_exposure',
    { experiment_id: experimentId, variant, surface },
  );
}
