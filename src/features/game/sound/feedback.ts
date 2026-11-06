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

export interface PlacementAudioAccent {
  jewel?: boolean;
  stoneHit?: boolean;
  stoneBreak?: boolean;
  won?: boolean;
}

export function playPlacementFeedback(
  event: PlacementEvent,
  settings: FeedbackSettings,
  accent: PlacementAudioAccent = {},
): void {
  if (handledPlacementFeedback.has(event)) return;
  handledPlacementFeedback.add(event);

  if (settings.sound) {
    // One clear texture includes impact + crumbs. Never sonify every particle.
    playSound(soundForPlacement(event));
    if (accent.stoneBreak) playSound('stonebreak');
    else if (accent.stoneHit) playSound('stonehit');
    // Victory replaces the collection accent on the final goal to keep the mix open.
    if (accent.won) playSound('victory');
    else if (accent.jewel) playSound('jewel');
  }
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
  if (settings.sound) playSound('return');
  if (settings.haptics && reason === 'occupied') androidHaptic(Haptics.AndroidHaptics.Reject);
}

export function playRecordFeedback(settings: FeedbackSettings): void {
  if (settings.sound) playSound('record');
  if (settings.haptics) androidHaptic(Haptics.AndroidHaptics.Confirm);
}
