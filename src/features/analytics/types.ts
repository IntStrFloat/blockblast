export interface AnalyticsEventMap {
  session_started: Record<string, never>;
  home_viewed: { home_state: string; cards_visible: string[] };
  mode_selected: { mode: 'classic' | 'daily' | 'adventure' | 'league'; source: string };
  result_viewed: {
    mode: 'classic' | 'adventure';
    score?: number;
    is_new_record?: boolean;
    best_at_start?: number;
    game_depth?: number;
  };
  record_progressed: {
    stage: 'pursuit' | 'near' | 'broken';
    score: number;
    best_at_start: number;
    game_depth: number;
  };
  reward_preview_seen: { source: string; reward: string };
  collection_opened: { source: string };
  nav_tab_selected: { tab: 'today' | 'path' | 'league' | 'capi' };
  play_tapped: {
    source: 'home' | 'game_over' | 'deeplink' | 'unknown';
    has_saved_game: boolean;
  };
  game_visible: {
    entry: 'home' | 'replay' | 'deeplink' | 'unknown';
    latency_ms: number;
    network_ready: boolean;
  };
  tutorial_shown: { step: string };
  tutorial_action: {
    step: string;
    result: 'grab' | 'valid_drop' | 'invalid_drop' | 'clear';
    elapsed_ms: number;
  };
  tutorial_completed: { elapsed_ms: number; placements: number; skipped: boolean };
  piece_grabbed: { first_in_install: boolean; game_depth: number };
  piece_dropped: { valid: boolean; first_in_install: boolean };
  first_line_cleared: { elapsed_ms: number; placements: number };
  daily_activated: {
    day: number;
    points: number;
    source: 'classic_clear' | 'adventure_win';
    multiplier?: number;
  };
  game_abandoned: {
    score: number;
    lines: number;
    duration_ms: number;
    reason: 'background' | 'exit' | 'terminated';
  };
  profile_created: { source: 'generated' | 'restored' };
  profile_chip_opened: { source: 'home' };
  game_start: { mode: 'weekly' | 'daily' };
  game_over: {
    score: number;
    linesCleared: number;
    revived: boolean;
    sessionDepth: number;
    duration_ms?: number;
    placements?: number;
    entry?: 'home' | 'replay' | 'deeplink' | 'unknown';
  };
  game_over_action: { action: 'replay' | 'revive' | 'home' };
  feature_revealed: {
    feature: 'daily' | 'adventure' | 'leaderboard' | 'notifications';
    games_played: number;
  };
  next_action_clicked: { kind: string };
  auto_prompt_shown: { kind: 'onboarding' | 'notifications' | 'review' };
  auto_prompt_result: {
    kind: 'onboarding' | 'notifications' | 'review';
    result: 'accepted' | 'later' | 'denied' | 'dismissed' | 'completed';
  };
  ad_eligible: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    blocked_reason?: string;
  };
  frame_budget_sample: { screen: string; p95_ms: number; dropped_frames: number };
  adventure_level_start: {
    seasonId: number;
    levelIndex: number;
    attempt: number;
    objective: 'score' | 'jewels';
  };
  adventure_level_win: {
    seasonId: number;
    levelIndex: number;
    attempt: number;
    consecutive: number;
  };
  adventure_level_fail: { seasonId: number; levelIndex: number; attempt: number };
  adventure_season_complete: { seasonId: number };
  revive_shown: { available: boolean };
  revive_used: { result: 'continued' | 'rewarded' | 'dismissed' | 'unavailable' };
  ad_requested: { format: 'banner' | 'interstitial' | 'rewarded'; placement: string };
  ad_shown: { format: 'banner' | 'interstitial' | 'rewarded'; placement: string };
  ad_failed: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    stage: 'load' | 'show' | 'init';
    message?: string;
  };
  daily_bonus_stage:
    | { stage: 'firstWin'; points: number; multiplier: number; day: number }
    | { stage: 'goal'; dropType: string };
  adventure_daily_goal_done: { cleared: number };
  level_up: { level: number; world: number };
  world_unlocked: { world: number };
  streak_lost: { count: number };
  season_reward_granted: { seasonId: number; cosmeticId: string };
  overtaken_shown: { from: number; to: number };
  notification_scheduled: { kind: string };
  notification_opened: { kind: string };
  session_depth: { gamesPlayed: number };
  leaderboard_opened: { source: 'home_card' | 'screen' };
  leaderboard_loaded: { source: 'local' | 'remote' };
  ranked_run_finished: { mode: 'weekly'; score: number };
  nickname_rerolled: { source: 'profile_overlay' };
  nickname_change_submitted: { source: 'profile_overlay' };
  nickname_change_result: { success: boolean };
  daily_challenge_exposed: { source: 'home_card' };
  daily_challenge_started: { source: 'home_card' };
  weekly_goal_exposed: { source: 'home_card' | 'cached' };
  weekly_goal_completed: { source: 'home_card' | 'cached' };
  weekly_prize_claimed: { rank: number; weekKey: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface AnalyticsEvent<Name extends AnalyticsEventName = AnalyticsEventName> {
  name: Name;
  properties: AnalyticsEventMap[Name];
  timestamp: number;
}

export type AnalyticsEntrySource =
  | 'organic'
  | 'notification'
  | 'deeplink'
  | 'unknown';

export interface AnalyticsCommonContext {
  schema_version: 1;
  session_id: string;
  session_index: number;
  app_version: string;
  build_number: string;
  platform: string;
  locale: string;
  games_played: number;
  is_first_session: boolean;
  entry_source: AnalyticsEntrySource;
}
