import { createContext, useContext } from 'react';
import type { MutableRefObject } from 'react';
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
  /** Актуализирует позицию доски перед началом drag */
  boardMeasureRef: MutableRefObject<(() => void) | null>;
  /** Зеркало доски для worklet-проверок */
  boardMirror: SharedValue<number[]>;
  /** Битовая маска превью: 1 — фигура, 2 — собираемая линия */
  preview: SharedValue<number[]>;
  /** colorId перетаскиваемой фигуры (0 — нет drag) */
  previewColor: SharedValue<number>;
  /** 1 пока активен drag-жест, иначе 0 — перф-сигнал для паузы маскота (спека 07/09) */
  dragActive: SharedValue<number>;
  /**
   * trayIndex фигуры, владеющей превью прямо сейчас (-1 — нет drag). Сериализует
   * перетаскивания: при мультитаче превью пишет только владелец, чужие маски не
   * «застревают». last-wins на onStart — защита от залипшего владельца.
   */
  dragOwner: SharedValue<number>;
  /** Цвета блоков активной темы (для ghost-подсветки) */
  cellColors: string[];
  /** Цвет фона доски активной темы */
  boardBg: string;
  /** Цвет пустой ячейки активной темы */
  cellEmpty: string;
  /**
   * Дроп на JS-поток; вызывается один раз на отпускание валидной позиции.
   * Возвращает true, если движок реально поставил фигуру (false — отклонено,
   * напр. позиция занята: тогда трей-слот надо вернуть видимым).
   */
  onDrop: (trayIndex: number, r: number, c: number) => boolean;
  /** Фидбек захвата фигуры (звук+хаптика) — один runOnJS на начало жеста */
  onGrab?: () => void;
}

const Ctx = createContext<DragCtx | null>(null);

export const DragProvider = Ctx.Provider;

export function useDragCtx(): DragCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDragCtx outside DragProvider');
  return ctx;
}
