/** Public API фичи game */
export {
  useGameStore,
  getSavedGameSummary,
  hasSavedGame,
  getSavedScore,
} from './store';
export type { NewGameOptions, ResumeKind, SavedGameSummary } from './store';
export { BoardView } from './components/BoardView';
export { TrayView } from './components/TrayView';
export { DragProvider, useDragCtx } from './drag/DragContext';
export type { DragCtx, BoardGeometry } from './drag/DragContext';
export { EMPTY_MASK, previewMask } from './drag/gridMath';
export { PraiseBanner } from './effects/PraiseBanner';
export { ComboBadge } from './effects/ComboBadge';
export { Confetti } from './effects/Confetti';
export { useGameFeedback } from './sound/useGameFeedback';
export { initSounds, playSound } from './sound/sounds';
export { eggForScore } from './easterEggs';
