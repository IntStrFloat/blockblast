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
  /**
   * Габарит одного слота трея для resting-scale: ширина и высота (в px). Нужен,
   * когда трей уже экрана (Adventure: paddingHorizontal + maxWidth) и/или клетка
   * доски крупная — тогда фигура ужимается под реальный слот и по ширине, и по
   * высоте. Без него TrayPiece берёт фолбэк (полная ширина экрана / 3, без
   * ограничения по высоте) — прежнее поведение Endless.
   */
  trayFit?: { slotWidth: number; slotHeight: number };
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
  cellLine?: string;
  cellRadius?: number;
  /**
   * Дроп на JS-поток; вызывается один раз на отпускание валидной позиции.
   * Возвращает true, если движок реально поставил фигуру (false — отклонено,
   * напр. позиция занята: тогда трей-слот надо вернуть видимым).
   */
  onDrop: (trayIndex: number, r: number, c: number) => boolean;
  /** Фидбек захвата фигуры (звук+хаптика) — один runOnJS на начало жеста */
  onGrab?: () => void;
  /**
   * Фидбек невалидного дропа (хаптика Reject): фигуру отпустили над доской на
   * занятой/не влезающей позиции. Отпускание вне доски — осознанный возврат в
   * трей, фидбек не даём.
   */
  onInvalidDrop?: () => void;
}

const Ctx = createContext<DragCtx | null>(null);

export const DragProvider = Ctx.Provider;

export function useDragCtx(): DragCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDragCtx outside DragProvider');
  return ctx;
}
