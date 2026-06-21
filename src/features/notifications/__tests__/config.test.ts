describe('push configuration', () => {
  const KEY = 'EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID';
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
    jest.resetModules();
  });

  it('defaults projectId to empty string when env is absent', () => {
    delete process.env[KEY];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PUSH } = require('../config') as typeof import('../config');
      expect(PUSH.projectId).toBe('');
      expect(PUSH.pushEnabled).toBe(true);
    });
  });

  it('uses build-time projectId when provided', () => {
    process.env[KEY] = 'proj-123';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PUSH } = require('../config') as typeof import('../config');
      expect(PUSH.projectId).toBe('proj-123');
    });
  });
});
