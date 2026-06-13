import { useEffect, useState } from 'react';

import type { ClearPresentation } from '../animation/clearPresentation';
import { SPECTACLE_MOTION } from '../animation/motion';
import { BlockCrushLayer } from './BlockCrushLayer';
import { ClearDebrisLayer } from './ClearDebrisLayer';
import { LineHighlightLayer } from './LineHighlightLayer';

interface ClearLayerProps {
  presentation: ClearPresentation | null;
}

export function ClearLayer({ presentation }: ClearLayerProps) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!presentation) return;
    const timer = setTimeout(
      () => setExpired(true),
      SPECTACLE_MOTION.praiseEndMs + 80,
    );
    return () => clearTimeout(timer);
  }, [presentation]);

  if (!presentation || expired) return null;

  return (
    <>
      <BlockCrushLayer presentation={presentation} />
      <LineHighlightLayer presentation={presentation} />
      <ClearDebrisLayer presentation={presentation} />
    </>
  );
}
