import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useInvalidDropNotice } from '../components/InvalidDropNotice';

describe('drag notice callback stability', () => {
  it('keeps the drag dependency object unchanged across unrelated renders and valid moves', () => {
    let notice!: ReturnType<typeof useInvalidDropNotice>;
    function Probe({ turn }: { turn: number }) {
      notice = useInvalidDropNotice('classic');
      return <React.Fragment>{turn}</React.Fragment>;
    }
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<Probe turn={0} />); });
    const first = notice;
    act(() => { tree.update(<Probe turn={1} />); });
    expect(notice).toBe(first);
    act(() => { notice.recordValidDrop(); });
    act(() => { tree.update(<Probe turn={2} />); });
    expect(notice).toBe(first);
    act(() => { tree.unmount(); });
  });
});
