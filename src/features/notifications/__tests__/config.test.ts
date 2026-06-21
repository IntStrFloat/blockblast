describe('push configuration', () => {
  const original = process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID;
    } else {
      process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID = original;
    }
    jest.resetModules();
  });

  it('defaults projectId to empty string when env is absent', () => {
    delete process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PUSH } = require('../config') as typeof import('../config');
      expect(PUSH.projectId).toBe('');
      expect(PUSH.pushEnabled).toBe(true);
    });
  });

  it('uses build-time projectId when provided', () => {
    process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID = 'proj-123';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PUSH } = require('../config') as typeof import('../config');
      expect(PUSH.projectId).toBe('proj-123');
    });
  });
});
