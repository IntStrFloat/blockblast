function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(loaded = Promise.resolve()) {
  const native = {
    init: jest.fn(() => loaded),
    play: jest.fn(() => 1),
    release: jest.fn(),
  };
  jest.doMock('expo', () => ({ requireNativeModule: () => native }));
  let sounds!: typeof import('../sound/sounds.android');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sounds = require('../sound/sounds.android');
  });
  return { native, ...sounds };
}

async function flush() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

afterEach(() => {
  jest.dontMock('expo');
  jest.restoreAllMocks();
  jest.resetModules();
});

it('dispatches every rapid pickup and drop without waiting for completion or seeking', async () => {
  const audio = setup();
  audio.initSounds();
  await flush();
  for (let index = 0; index < 100; index += 1) {
    audio.playSound('pickup');
    audio.playSound('drop');
  }
  expect(audio.native.init).toHaveBeenCalledTimes(1);
  expect(audio.native.play).toHaveBeenCalledTimes(200);
  expect(audio.native.play.mock.calls).toEqual(
    Array.from({ length: 100 }, () => [['pickup'], ['drop']]).flat(),
  );
});

it('keeps initial inputs until native sample loading finishes', async () => {
  const load = deferred();
  const audio = setup(load.promise);
  audio.playSound('pickup');
  audio.playSound('drop');
  expect(audio.native.play).not.toHaveBeenCalled();
  load.resolve();
  await flush();
  expect(audio.native.play.mock.calls).toEqual([['pickup'], ['drop']]);
});

it('never replays inputs from a released session after reinitialization', async () => {
  const oldLoad = deferred();
  const audio = setup(oldLoad.promise);
  audio.playSound('pickup');
  audio.releaseSounds();
  audio.native.init.mockReturnValueOnce(Promise.resolve());
  audio.playSound('clear1');
  await flush();
  oldLoad.resolve();
  await flush();
  expect(audio.native.play.mock.calls).toEqual([['clear1']]);
  expect(audio.native.release).toHaveBeenCalledTimes(1);
});

it('reports a failed preload and retries initialization on the next request', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const audio = setup(Promise.reject(new Error('decode failed')));
  audio.playSound('pickup');
  await flush();
  expect(warning).toHaveBeenCalled();
  expect(audio.native.play).not.toHaveBeenCalled();
  expect(audio.native.release).toHaveBeenCalledTimes(1);
  audio.native.init.mockReturnValueOnce(Promise.resolve());
  audio.playSound('drop');
  await flush();
  expect(audio.native.play.mock.calls).toEqual([['drop']]);
});
