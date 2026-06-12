import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export interface BoardGeometry {
  boardSize: number;
  cell: number;
  gap: number;
  pad: number;
}

export interface DragCtx {
  geom: BoardGeometry;
  /** Позиция доски в координатах окна (measureInWindow) */
  boardOrigin: SharedValue<{ x: number; y: number }>;
  /** Зеркало доски для worklet-проверок */
  boardMirror: SharedValue<number[]>;
  /** Маска превью 0/1/2 (gridMath.previewMask) */
  preview: SharedValue<number[]>;
  /** colorId перетаскиваемой фигуры (0 — нет drag) */
  previewColor: SharedValue<number>;
  /** Цвета блоков активной темы (для ghost-подсветки) */
  cellColors: string[];
  /** Дроп на JS-поток; вызывается один раз на отпускание валидной позиции */
  onDrop: (trayIndex: number, r: number, c: number) => void;
}

const Ctx = createContext<DragCtx | null>(null);

export const DragProvider = Ctx.Provider;

export function useDragCtx(): DragCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDragCtx outside DragProvider');
  return ctx;
}
