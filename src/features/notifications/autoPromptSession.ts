export type AutoPromptKind = 'notifications' | 'onboarding' | 'review';

export interface AutoPromptBlockers {
  blockingOverlayVisible: boolean;
  userDialogOpen: boolean;
}

let claimedPrompt: AutoPromptKind | null = null;

/** Claims the one auto-prompt slot for the current JS/app session. */
export function claimAutoPrompt(
  kind: AutoPromptKind,
  blockers: AutoPromptBlockers,
): boolean {
  if (claimedPrompt !== null || blockers.blockingOverlayVisible || blockers.userDialogOpen) {
    return false;
  }
  claimedPrompt = kind;
  return true;
}

export function getClaimedAutoPrompt(): AutoPromptKind | null {
  return claimedPrompt;
}

/** Test-only reset; an app session never releases its automatic prompt slot. */
export function resetAutoPromptSessionForTests(): void {
  claimedPrompt = null;
}
