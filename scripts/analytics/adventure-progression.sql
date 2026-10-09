-- Run after scripts/analytics/retention-baseline.sql in the same DuckDB database.
-- G06 metrics use logical completion_id and canonical run_result rows.

create or replace view progression_reward_facts as
select
  installation_id,
  try_cast(event_timestamp as bigint) as event_ts,
  json_extract_string(event_json, '$.run_id') as run_id,
  json_extract_string(event_json, '$.product_session_id') as product_session_id,
  json_extract_string(event_json, '$.mode') as mode,
  json_extract_string(event_json, '$.reward_type') as reward_type,
  json_extract_string(event_json, '$.reward_id') as reward_id,
  json_extract_string(event_json, '$.completion_id') as completion_id,
  coalesce(try_cast(json_extract_string(event_json, '$.amount') as bigint), 0) as amount
from rewards_dedup;

create or replace view canonical_run_facts as
select
  installation_id,
  json_extract_string(event_json, '$.run_id') as run_id,
  json_extract_string(event_json, '$.mode') as mode,
  try_cast(event_timestamp as bigint) as result_ts,
  coalesce(
    try_cast(json_extract_string(event_json, '$.active_duration_ms') as bigint),
    0
  ) as active_duration_ms,
  json_extract_string(event_json, '$.result') as result
from run_results;

-- XP per active minute by mode. Rows without a canonical positive duration are
-- reported separately instead of being silently divided by zero.
create or replace view xp_per_active_minute as
select
  coalesce(r.mode, p.mode, 'unknown') as mode,
  sum(p.amount) filter (where r.active_duration_ms > 0) as xp_with_duration,
  sum(r.active_duration_ms) filter (where r.active_duration_ms > 0) / 60000.0
    as active_minutes,
  sum(p.amount) filter (where r.active_duration_ms > 0)
    / nullif(
        sum(r.active_duration_ms) filter (where r.active_duration_ms > 0) / 60000.0,
        0
      ) as xp_per_minute,
  count(*) filter (where r.active_duration_ms <= 0 or r.active_duration_ms is null)
    as rewards_without_duration
from progression_reward_facts p
left join canonical_run_facts r using (installation_id, run_id)
where p.reward_type = 'xp'
group by 1;

-- Time to the first authored unlock, not to the first XP receipt. The first
-- authored unlock is represented by reward_type=progression.
create or replace view time_to_first_reward as
with first_run as (
  select
    installation_id,
    min(try_cast(event_timestamp as bigint)) as first_run_ts
  from events_dedup
  where event_name = 'run_started'
  group by 1
), first_reward as (
  select
    installation_id,
    min(event_ts) as first_reward_ts,
    arg_min(mode, event_ts) as unlock_mode,
    arg_min(reward_id, event_ts) as reward_id
  from progression_reward_facts
  where reward_type = 'progression'
  group by 1
)
select
  c.installation_id,
  c.first_mode,
  f.unlock_mode,
  f.reward_id,
  (f.first_reward_ts - r.first_run_ts) / 1000.0 as seconds_to_first_reward
from install_cohorts c
left join first_run r using (installation_id)
left join first_reward f using (installation_id);

create or replace view adventure_first_unlock_rate as
select
  first_launch_version,
  count(*) as adventure_first_installs,
  count(*) filter (where seconds_to_first_reward is not null) as unlocked,
  count(*) filter (where seconds_to_first_reward is not null)::double
    / nullif(count(*), 0) as unlock_rate
from time_to_first_reward t
join install_cohorts c using (installation_id, first_mode)
where first_mode = 'adventure'
group by 1;

-- Experiment outcome: did a later product session occur after the third/fifth
-- unique Adventure completion? This is not a functional release gate.
create or replace view adventure_return_after_wins as
with wins as (
  select
    installation_id,
    try_cast(event_timestamp as bigint) as win_ts,
    json_extract_string(event_json, '$.completionId') as completion_id,
    row_number() over (
      partition by installation_id
      order by try_cast(event_timestamp as bigint),
        json_extract_string(event_json, '$.completionId')
    ) as win_number
  from events_dedup
  where event_name = 'adventure_level_win'
), checkpoints as (
  select
    installation_id,
    max(case when win_number = 3 then win_ts end) as third_win_ts,
    max(case when win_number = 5 then win_ts end) as fifth_win_ts
  from wins
  where win_number <= 5
  group by 1
)
select
  c.installation_id,
  third_win_ts is not null as reached_three_wins,
  fifth_win_ts is not null as reached_five_wins,
  exists (
    select 1 from events_dedup e
    where e.installation_id = c.installation_id
      and e.event_name = 'session_started'
      and try_cast(e.event_timestamp as bigint) > c.third_win_ts
  ) as returned_after_three,
  exists (
    select 1 from events_dedup e
    where e.installation_id = c.installation_id
      and e.event_name = 'session_started'
      and try_cast(e.event_timestamp as bigint) > c.fifth_win_ts
  ) as returned_after_five
from checkpoints c;
