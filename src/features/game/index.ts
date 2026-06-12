/** Public API фичи game */
export { useGameStore, hasSavedGame } from './store';
export { BoardView } from './components/BoardView';
export { TrayView } from './components/TrayView';
export { DragProvider } from './drag/DragContext';
export type { DragCtx, BoardGeometry } from './drag/DragContext';
export { EMPTY_MASK } from './drag/gridMath';
