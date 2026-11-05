export interface AnalyticsEventMap {
  ad_reward_offer: {
    placement: string;
    completion_id: string;
    amount: number;
    phase: 'offered' | 'requested' | 'earned' | 'applied' | 'dismissed' | 'unavailable' | 'failed';
    policy_version: string;
  };
  ad_revenue: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id: string;
    impression_id?: string;
    ad_unit_id: string;
    revenue: number;
    currency: string;
    revenue_usd?: number;
    precision?: string;
    network?: string;
    network_ad_unit_id?: string;
    policy_version: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    result_context_id?: string;
    load_id?: string;
  };
  session_started: Record<string, never>;
  session_resumed: { paused_duration_ms: number };
  session_ended: { reason: 'background_timeout' | 'process_death' | 'explicit' };
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
    entry: 'home' | 'new' | 'resume' | 'tutorial' | 'replay' | 'deeplink' | 'unknown';
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
  tutorial_clear_outcome: {
    experiment_id: string;
    variant: string;
    metric_version: string;
    outcome: 'guided_success' | 'assisted_clear' | 'independent_success';
    accepted_moves_after_fixture: number;
    within_10: boolean;
    skipped: boolean;
  };
  tutorial_metric_window_closed: {
    experiment_id: string;
    variant: string;
    metric_version: string;
    accepted_moves_after_fixture: number;
    independent_clear: boolean;
    skipped: boolean;
  };
  piece_grabbed: { first_in_install: boolean; game_depth: number };
  piece_dropped: { valid: boolean; first_in_install: boolean };
  invalid_drop: {
    mode: AnalyticsGameMode;
    reason: 'occupied' | 'outside-board' | 'unavailable';
    streak: number;
    placement_index: number;
    shape_id?: string;
  };
  helper_funnel: {
    helper: 'hint' | 'swap';
    stage: 'eligible' | 'shown' | 'used';
    source: 'free' | 'charge' | 'rewarded';
    remaining_charges: number;
  };
  turn_input_ready: {
    mode: AnalyticsGameMode;
    elapsed_ms: number;
    new_tray: boolean;
    cleared_lines: number;
    readiness_source: 'existing_tray' | 'native_layout';
  };
  adventure_result_ready: {
    elapsed_ms: number;
    objective: 'score' | 'jewels';
    reduced_motion: boolean;
    accelerated: boolean;
  };
  effect_conflict: {
    mode: AnalyticsGameMode;
    clear_presentations: number;
    placement_presentations: number;
  };
  run_started: { mode: AnalyticsGameMode; start_kind: 'new' | 'restart' };
  run_resumed: { mode: AnalyticsGameMode; resume_kind: 'saved' | 'revive' };
  resume_attempt: { mode: AnalyticsGameMode; saved_state: string };
  resume_result: {
    mode: AnalyticsGameMode;
    result: 'resumed' | 'result_opened' | 'fallback';
    reason: 'active' | 'terminal_revivable' | 'terminal_final' | 'missing' | 'corrupt' | 'incompatible';
  };
  return_first_move: {
    mode: AnalyticsGameMode;
    elapsed_ms: number;
    placement_index: number;
  };
  piece_accepted: {
    mode: AnalyticsGameMode;
    placement_index: number;
    cleared_lines: number;
    guidance: 'guided' | 'assisted' | 'independent';
  };
  first_guided_clear: { mode: AnalyticsGameMode; placement_index: number };
  first_independent_clear: { mode: AnalyticsGameMode; placement_index: number };
  run_result: {
    mode: AnalyticsGameMode;
    result: 'completed' | 'failed' | 'abandoned';
    reason: AnalyticsRunEndReason;
    active_duration_ms: number;
    placements: number;
    score?: number;
    lines?: number;
  };
  run_exit: { mode: AnalyticsGameMode; reason: AnalyticsRunEndReason };
  new_game: { mode: AnalyticsGameMode; source: 'home' | 'result' | 'restart' | 'next' };
  reward_granted: {
    reward_type: 'xp' | 'season_cosmetic' | 'ad_reward' | 'progression';
    amount?: number;
    reward_id?: string;
    completion_id?: string;
    mode?: AnalyticsGameMode;
    first_completion?: boolean;
  };
  duplicate_reward_count: { run_id: string; reward_id: string; target_amount: number };
  checkpoint_recovery: {
    run_id: string;
    checkpoint_version: number;
    reason: 'pending_settlement' | 'legacy_migration' | 'cold_resume';
  };
  checkpoint_counter_mismatch: {
    run_id: string;
    counter: 'linesCleared' | 'placements' | 'activeDurationMs';
    checkpoint_value: number;
    runtime_value: number;
  };
  next_goal_presented: { mode?: AnalyticsGameMode; goal_type: string; goal_id: string };
  next_goal_completed: { goal_type: string; goal_id: string };
  next_run: { goal_type: string; goal_id: string; mode: AnalyticsGameMode };
  experiment_exposure: {
    experiment_id: string;
    variant: string;
    surface: string;
  };
  experiment_assignment: {
    experiment_id: string;
    variant: string;
    unit: 'installation';
    enrollment: 'new_install';
  };
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
  next_action_clicked: { kind: string; goal_id?: string };
  reward_equipped: { item_id: string; source: 'wardrobe' | 'map'; first_equip: boolean };
  auto_prompt_shown: { kind: 'onboarding' | 'notifications' | 'review' };
  auto_prompt_result: {
    kind: 'onboarding' | 'notifications' | 'review';
    result: 'accepted' | 'later' | 'denied' | 'dismissed' | 'completed';
  };
  ad_eligible: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    blocked_reason?: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
  };
  interstitial_policy_eligible: {
    experiment_id: string;
    variant: 'control' | 'first_session_capped';
    placement: string;
    mode: AnalyticsGameMode;
    decision: 'request' | 'suppressed_first_session' | 'suppressed_session_cap' | 'suppressed_adventure_retry' | 'suppressed_short_run' | 'suppressed_rewarded_offer' | 'suppressed_fullscreen_cooldown';
    policy_version?: string;
    result_context_id?: string;
    active_play_ms: number;
    session_depth: number;
    session_interstitial_shows: number;
    product_session_id: string;
  };
  frame_budget_sample: { screen: string; p95_ms: number; dropped_frames: number };
  adventure_level_start: {
    seasonId: number;
    levelIndex: number;
    attempt: number;
    objective: 'score' | 'jewels';
    failure_count: number;
    help_policy: 'none' | 'highlight' | 'declined';
  };
  adventure_level_win: {
    seasonId: number;
    levelIndex: number;
    attempt: number;
    consecutive: number;
    completionId?: string;
  };
  adventure_level_fail: {
    seasonId: number;
    levelIndex: number;
    attempt: number;
    objective: 'score' | 'jewels';
    current: number;
    target: number;
    remaining: number;
    failure_count: number;
    help_policy: 'none' | 'highlight' | 'declined';
  };
  adventure_retry_decision: {
    seasonId: number;
    levelIndex: number;
    attempt: number;
    failure_count: number;
    decision: 'standard' | 'help' | 'exit' | 'voluntary_restart';
  };
  adventure_objective_collected: {
    presentation_id: string;
    delta: number;
    total: number;
    remaining: number;
  };
  adventure_objective_hud_arrived: {
    presentation_id: string;
    delta: number;
    total: number;
    wait_ms: number;
    reduced_motion: boolean;
  };
  adventure_season_complete: { seasonId: number };
  revive_shown: { available: boolean };
  revive_used: { result: 'continued' | 'rewarded' | 'dismissed' | 'unavailable' };
  ad_requested: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
    load_id?: string;
  };
  ad_load_requested: {
    format: 'interstitial' | 'rewarded';
    load_id: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    product_session_id?: string;
    session_depth?: number;
  };
  ad_loaded: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
    load_id?: string;
  };
  ad_shown: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
    load_id?: string;
  };
  ad_clicked: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
    load_id?: string;
  };
  ad_dismissed: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
    load_id?: string;
  };
  ad_rewarded: {
    format: 'rewarded';
    placement: string;
    attempt_id?: string;
  };
  ad_failed: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    stage: 'load' | 'show' | 'init';
    message?: string;
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
    load_id?: string;
  };
  ad_result: {
    format: 'banner' | 'interstitial' | 'rewarded';
    placement: string;
    attempt_id?: string;
    result: 'shown' | 'clicked' | 'dismissed' | 'rewarded' | 'failed' | 'unavailable';
    experiment_id?: string;
    variant?: 'control' | 'first_session_capped';
    mode?: AnalyticsGameMode;
    active_play_ms?: number;
    session_depth?: number;
    product_session_id?: string;
    session_interstitial_shows?: number;
    load_id?: string;
  };
  daily_bonus_stage:
    | { stage: 'firstWin'; points: number; multiplier: number; day: number }
    | { stage: 'goal'; dropType: string };
  adventure_daily_goal_done: { cleared: number };
  level_up: { level: number; world: number };
  world_unlocked: { world: number };
  streak_lost: { count: number };
  streak_protector_saved: { count: number };
  season_reward_granted: { seasonId: number; cosmeticId: string };
  overtaken_shown: { from: number; to: number };
  notification_scheduled: { kind: string };
  notification_opened: {
    kind: string;
    origin: 'local' | 'remote';
    attribution_id?: string;
    route?: string;
  };
  notification_target_viewed: {
    attribution_id: string;
    kind: string;
    route: string;
    elapsed_ms: number;
  };
  notification_target_action: {
    attribution_id: string;
    kind: string;
    action: string;
    elapsed_ms: number;
  };
  notification_permission_result: {
    source: 'soft_ask' | 'settings';
    local: 'granted' | 'denied' | 'error';
    remote: 'granted' | 'denied' | 'unavailable' | 'error';
    outcome: 'granted' | 'denied' | 'unavailable' | 'error';
  };
  notification_permission_probe_error: { surface: 'home' };
  notification_soft_ask_eligible: {
    meaningful_sessions: number;
    last_meaningful_mode: 'classic' | 'adventure' | 'unknown';
  };
  notification_soft_ask_shown: {
    meaningful_sessions: number;
    last_meaningful_mode: 'classic' | 'adventure' | 'unknown';
  };
  notification_soft_ask_result: {
    result: 'accepted' | 'later';
    last_meaningful_mode: 'classic' | 'adventure' | 'unknown';
  };
  notification_unsubscribed: { source: 'system' };
  stale_countdown: {
    reason: 'focus' | 'foreground' | 'timer';
    had_window: boolean;
    window_id?: string;
  };
  session_depth: { gamesPlayed: number };
  leaderboard_opened: { source: 'home_card' | 'screen' };
  leaderboard_loaded: { source: 'local' | 'remote' };
  ranked_run_finished: { mode: 'weekly'; score: number };
  nickname_rerolled: { source: 'profile_overlay' };
  nickname_change_submitted: { source: 'profile_overlay' };
  nickname_change_result: { success: boolean };
  daily_challenge_exposed: { source: 'home_card' };
  daily_challenge_started: { source: 'home_card' };
  weekly_goal_assigned: { goal_id: string; week_key: string; target: number };
  weekly_goal_exposed: {
    source: 'home_card' | 'cached' | 'leaderboard';
    goal_id: string;
    week_key: string;
    current: number;
    target: number;
  };
  weekly_goal_completed: {
    source: 'home_card' | 'cached' | 'leaderboard';
    goal_id: string;
    week_key: string;
    current: number;
    target: number;
  };
  weekly_prize_eligible: { reward_id: string; week_key: string; rank: number };
  weekly_prize_claim_started: { reward_id: string; week_key: string; rank: number };
  weekly_prize_claim_result: {
    reward_id: string;
    week_key: string;
    rank: number;
    result: 'claimed' | 'error';
  };
  weekly_prize_applied: {
    reward_id: string;
    week_key: string;
    rank: number;
    applied_delta: number;
    effect_scope: 'local_profile';
  };
  weekly_prize_error: {
    reward_id?: string;
    week_key?: string;
    stage: 'fetch' | 'claim' | 'apply';
    code: string;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsGameMode = 'classic' | 'adventure';

export type AnalyticsRunEndReason =
  | 'game_over'
  | 'level_won'
  | 'level_failed'
  | 'home'
  | 'restart'
  | 'background_timeout'
  | 'process_death'
  | 'replaced';

export interface AnalyticsEvent<Name extends AnalyticsEventName = AnalyticsEventName> {
  event_id: string;
  name: Name;
  properties: AnalyticsEventMap[Name];
  timestamp: number;
  /** Null is intentional for events emitted before product-session bootstrap. */
  context: AnalyticsCommonContext | null;
  run_id: string | null;
  context_status: 'ready' | 'bootstrap_unattributed';
}

export type AnalyticsEntrySource =
  | 'organic'
  | 'notification'
  | 'deeplink'
  | 'unknown';

export interface AnalyticsCommonContext {
  schema_version: 2;
  config_version: string;
  /** Product session. AppMetrica owns its SDK session independently. */
  session_id: string;
  product_session_id: string;
  session_index: number;
  app_version: string;
  build_number: string;
  platform: string;
  locale: string;
  /** Stable lifetime counter; retained for compatibility with existing reports. */
  games_played: number;
  lifetime_games: number;
  session_games: number;
  is_first_session: boolean;
  /** Способ входа в текущую сессию, не источник установки из acquisition-отчёта. */
  entry_source: AnalyticsEntrySource;
  first_launch_version: string;
  install_state: 'new_install' | 'updated_install' | 'existing_install' | 'unknown';
  device_class: 'phone' | 'tablet' | 'desktop' | 'unknown';
}

export interface AnalyticsRunState {
  run_id: string;
  mode: AnalyticsGameMode;
  started_at_ms: number;
  active_since_ms: number | null;
  active_duration_ms: number;
  placements: number;
  lines: number;
  result_revision: number;
  first_grab_recorded: boolean;
  first_guided_clear_recorded: boolean;
  first_independent_clear_recorded: boolean;
  terminal_reported: boolean;
}
