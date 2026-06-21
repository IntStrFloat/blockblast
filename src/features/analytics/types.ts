export interface AnalyticsEventMap {
  profile_created: { source: 'generated' | 'restored' };
  profile_chip_opened: { source: 'home' };
  game_start: { mode: 'weekly' | 'daily' };
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
