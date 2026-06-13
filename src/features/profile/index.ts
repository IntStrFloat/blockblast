export { ProfileChip } from './components/ProfileChip';
export { ProfileOverlay } from './components/ProfileOverlay';
export {
  createGeneratedProfile,
  normalizeNickname,
  validateNickname,
  type GeneratedProfile,
  type NicknameValidationError,
} from './nickname';
export { createProfileStore, useProfileStore, type ProfileState } from './store';
