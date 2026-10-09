/** Public API фичи game */
export {
  useGameStore,
  getSavedGameSummary,
  getSavedAdventureSummary,
  hasSavedGame,
  getSavedScore,
} from './store';
export type {
  ClassicRunMeta,
  NewGameOptions,
  ResumeKind,
  SavedAdventureSummary,
  SavedGameKind,
  SavedGameSummary,
} from './store';
export { BoardView } from './components/BoardView';
export { InvalidDropNotice, useInvalidDropNotice } from './components/InvalidDropNotice';
export type { InvalidDropReason } from './components/InvalidDropNotice';
export { TrayView } from './components/TrayView';
export { DragProvider, useDragCtx } from './drag/DragContext';
export type { DragCtx, BoardGeometry } from './drag/DragContext';
export { EMPTY_MASK, previewMask } from './drag/gridMath';
export { PraiseBanner } from './effects/PraiseBanner';
export { ComboBadge } from './effects/ComboBadge';
export { Confetti } from './effects/Confetti';
export { useGameFeedback } from './sound/useGameFeedback';
export { useDelayedTray } from './animation/useDelayedTray';
export { turnReadinessSource } from './turnReadiness';
export {
  EFFECT_NODE_BUDGET,
  EFFECT_SEQUENCE_TIMING,
  effectSequenceTierFor,
  highComboAuraIntensity,
} from './animation/effectSequence';
export { initSounds, playSound } from './sound/sounds';
export { eggForScore } from './easterEggs';
export {
  getAdventurePlayfieldMetrics,
  getClassicPlayfieldMetrics,
  getClassicTrayHeight,
  getPlayfieldBoardMetrics,
  PLAYFIELD_LAYOUT,
} from './playfield-layout';
