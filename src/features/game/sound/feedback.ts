import * as Haptics from 'expo-haptics';

import type { PlacementEvent } from '@/core/engine';

import { soundForPlacement } from './soundEvents';
import { playSound } from './sounds';

interface FeedbackSettings {
  sound: boolean;
  haptics: boolean;
}

const handledPlacementFeedback = new WeakSet<PlacementEvent>();

function haptic(fn: () => Promise<void>): void {
  fn().catch(() => {});
}

function androidHaptic(type: Haptics.AndroidHaptics): void {
  haptic(() => Haptics.performAndroidHapticsAsync(type));
}

function placementHapticFor(event: PlacementEvent): Haptics.AndroidHaptics {
  const lines = event.clearedRows.length + event.clearedCols.length;
  if (lines >= 1 || event.onFire || event.boardCleared) return Haptics.AndroidHaptics.Confirm;
  if (event.gameOver) return Haptics.AndroidHaptics.Reject;
  return Haptics.AndroidHaptics.Gesture_End;
}

export function markPlacementFeedbackHandled(event: PlacementEvent): void {
  handledPlacementFeedback.add(event);
}

export function playPlacementFeedback(
  event: PlacementEvent,
  settings: FeedbackSettings,
): void {
  if (handledPlacementFeedback.has(event)) return;
  handledPlacementFeedback.add(event);

  if (settings.sound) playSound(soundForPlacement(event));
  if (settings.haptics) androidHaptic(placementHapticFor(event));
}

export function playGrabFeedback(settings: FeedbackSettings): void {
  if (settings.sound) playSound('pickup');
  if (settings.haptics) androidHaptic(Haptics.AndroidHaptics.Drag_Start);
}

/** Returning a piece has a release cue; only occupied cells reject haptically. */
export function playInvalidDropFeedback(
  settings: FeedbackSettings,
  reason: 'occupied' | 'outside-board' = 'occupied',
): void {
  if (settings.sound) playSound('drop');
  if (settings.haptics && reason === 'occupied') androidHaptic(Haptics.AndroidHaptics.Reject);
}

export function playRecordFeedback(settings: FeedbackSettings): void {
  if (settings.sound) playSound('record');
  if (settings.haptics) androidHaptic(Haptics.AndroidHaptics.Confirm);
}
