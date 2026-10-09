export { useOnboarding, shouldShowOnboarding } from './store';
export { OnboardingOverlay } from './components/OnboardingOverlay';
export { WelcomeNotificationOverlay } from './components/WelcomeConsentOverlay';
export { useWelcomePromptStore } from './welcomePromptStore';
export {
  FTUE_VERSION,
  FTUE_STORAGE_KEY,
  FTUE_EXPERIMENT_ID,
  FTUE_METRIC_MOVE_LIMIT,
  FTUE_METRIC_VERSION,
  ftueCheckpointForRun,
  isInitialFtueGuidance,
  migrateFtueState,
  resolveFtueVariant,
  shouldEnterFtue,
  shouldShowFtueAssistance,
  useFtueStore,
} from './ftueStore';
export type {
  FtueOutcome,
  FtuePlacementResult,
  FtueState,
  FtueStatus,
  FtueVariant,
} from './ftueStore';
export {
  createTutorialGame,
  findTutorialRecommendation,
  isTutorialRecommendationValid,
} from './tutorialGame';
export type { TutorialRecommendation } from './tutorialGame';
export { TutorialPointer } from './components/TutorialPointer';
