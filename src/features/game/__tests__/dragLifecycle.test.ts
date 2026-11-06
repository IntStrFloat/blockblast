import { dropCommitFor } from '../drag/dropLifecycle';

describe('drop lifecycle', () => {
  it('does not commit a long hold or invalid release', () => {
    expect(dropCommitFor(1, -1, -1)).toBeNull();
  });

  it('does not commit a cancelled gesture', () => {
    expect(dropCommitFor(1, 2, 3, false)).toBeNull();
  });

  it('returns one commit payload for a valid completed drop', () => {
    expect(dropCommitFor(1, 2, 3, true)).toEqual({
      trayIndex: 1,
      row: 2,
      col: 3,
    });
  });
});
