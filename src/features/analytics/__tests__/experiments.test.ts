import { KEYS, removeKey } from '@/core/storage';

import { assignExperimentVariant } from '../experiments';

beforeEach(() => removeKey(KEYS.analyticsExperiments));

it('keeps experiment assignment stable across version and process boundaries', () => {
  const first = assignExperimentVariant('retention-loop-v1', ['control', 'treatment'], () => 'install-seed');
  const second = assignExperimentVariant('retention-loop-v1', ['control', 'treatment'], () => 'different-seed');
  expect(second).toBe(first);
});
