import { KEYS, getJSON, setJSON } from '@/core/storage';

interface PushPromptState {
  gameOvers: number;
  handled: boolean;
}

const EMPTY: PushPromptState = { gameOvers: 0, handled: false };

/** Минимум проигрышей до показа мягкого запроса разрешения. */
const MIN_GAME_OVERS = 1;

function load(): PushPromptState {
  return getJSON<PushPromptState>(KEYS.pushPrompt) ?? EMPTY;
}

/** Вызывается при закрытии экрана Game Over. */
export function recordGameOverForPush(): void {
  const state = load();
  if (state.handled) return;
  setJSON(KEYS.pushPrompt, { ...state, gameOvers: state.gameOvers + 1 });
}

/** Показывать ли soft-ask сейчас. */
export function shouldShowPushSoftAsk(): boolean {
  const state = load();
  return !state.handled && state.gameOvers >= MIN_GAME_OVERS;
}

/** Игрок принял решение (да/нет) — больше не доспрашиваем. */
export function markPushSoftAskHandled(): void {
  setJSON(KEYS.pushPrompt, { ...load(), handled: true });
}
