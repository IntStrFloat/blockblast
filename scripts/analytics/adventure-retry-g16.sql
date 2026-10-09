-- G16 Adventure failure/retry/help metrics.
-- Run after scripts/analytics/retention-baseline.sql.

create or replace view adventure_g16_attempts as
select
  installation_id,
  json_extract_string(event_json, '$.run_id') as run_id,
  try_cast(event_timestamp as bigint) as started_ts,
  try_cast(json_extract_string(event_json, '$.seasonId') as bigint) as season_id,
  try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) as level_index,
  coalesce(try_cast(json_extract_string(event_json, '$.attempt') as bigint), 0) as attempt,
  coalesce(try_cast(json_extract_string(event_json, '$.failure_count') as bigint), 0) as failure_count,
  coalesce(json_extract_string(event_json, '$.help_policy'), 'none') as help_policy
from events_dedup
where event_name = 'adventure_level_start';

create or replace view adventure_g16_outcomes as
select
  installation_id,
  json_extract_string(event_json, '$.run_id') as run_id,
  event_name = 'adventure_level_win' as won,
  try_cast(event_timestamp as bigint) as outcome_ts,
  try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) as level_index,
  coalesce(try_cast(json_extract_string(event_json, '$.attempt') as bigint), 0) as attempt
from events_dedup
where event_name in ('adventure_level_win', 'adventure_level_fail');

create or replace view adventure_g16_level_attempt_summary as
select
  a.level_index,
  a.attempt,
  a.help_policy,
  count(*) as starts,
  count(o.run_id) as terminal_attempts,
  count(*) filter (where o.won) as wins,
  count(*) filter (where not o.won) as failures,
  count(*) filter (where o.won)::double / nullif(count(o.run_id), 0) as win_rate
from adventure_g16_attempts a
left join adventure_g16_outcomes o using (installation_id, run_id, level_index, attempt)
group by 1, 2, 3;

create or replace view adventure_g16_retry_decisions as
select
  try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) as level_index,
  coalesce(try_cast(json_extract_string(event_json, '$.failure_count') as bigint), 0) as failure_count,
  json_extract_string(event_json, '$.decision') as decision,
  count(*) as decisions
from events_dedup
where event_name = 'adventure_retry_decision'
group by 1, 2, 3;

create or replace view adventure_g16_fail_retry_summary as
select
  failure_count,
  sum(decisions) filter (where decision in ('standard', 'help')) as retries,
  sum(decisions) filter (where decision = 'help') as help_accepts,
  sum(decisions) filter (where decision = 'exit') as exits,
  sum(decisions) filter (where decision in ('standard', 'help'))::double /
    nullif(sum(decisions) filter (where decision in ('standard', 'help', 'exit')), 0)
    as fail_to_retry_rate,
  sum(decisions) filter (where decision = 'exit')::double /
    nullif(sum(decisions) filter (where decision in ('standard', 'help', 'exit')), 0)
    as exit_rate
from adventure_g16_retry_decisions
group by 1;

create or replace view adventure_g16_duration_summary as
select
  json_extract_string(event_json, '$.reason') as outcome,
  quantile_cont(
    coalesce(try_cast(json_extract_string(event_json, '$.active_duration_ms') as bigint), 0),
    0.5
  ) as p50_active_ms,
  quantile_cont(
    coalesce(try_cast(json_extract_string(event_json, '$.active_duration_ms') as bigint), 0),
    0.95
  ) as p95_active_ms
from run_results
where json_extract_string(event_json, '$.mode') = 'adventure'
group by 1;

-- Functional help acceptance is measured independently from retention.
create or replace view adventure_g16_help_funnel as
select
  count(*) filter (where help_policy = 'highlight') as assisted_starts,
  count(*) filter (where help_policy = 'declined') as declined_starts,
  count(*) filter (where failure_count >= 2) as eligible_or_later_starts
from adventure_g16_attempts
where level_index between 0 and 4;

-- Calendar D1 for Adventure-first installs uses the canonical cohort table.
create or replace view adventure_first_d1_g16 as
select
  first_launch_version,
  acquisition_source,
  device_class,
  sum(cohort_size) as installs,
  sum(d1_returns) as d1_returns,
  sum(d1_returns)::double / nullif(sum(cohort_size), 0) as d1
from retention_baseline
where first_mode = 'adventure'
group by 1, 2, 3;
