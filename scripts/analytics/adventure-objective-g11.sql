-- G11 Adventure objective readability and presentation metrics.
-- Run after scripts/analytics/retention-baseline.sql in the same DuckDB database.

create or replace view adventure_objective_collections as
select
  installation_id,
  try_cast(event_timestamp as bigint) as committed_ts,
  json_extract_string(event_json, '$.presentation_id') as presentation_id,
  coalesce(try_cast(json_extract_string(event_json, '$.delta') as bigint), 0) as delta,
  coalesce(try_cast(json_extract_string(event_json, '$.total') as bigint), 0) as total,
  coalesce(try_cast(json_extract_string(event_json, '$.remaining') as bigint), 0) as remaining
from events_dedup
where event_name = 'adventure_objective_collected';

create or replace view adventure_objective_hud_wait as
select
  a.installation_id,
  try_cast(a.event_timestamp as bigint) as arrived_ts,
  json_extract_string(a.event_json, '$.presentation_id') as presentation_id,
  coalesce(try_cast(json_extract_string(a.event_json, '$.delta') as bigint), 0) as delta,
  coalesce(try_cast(json_extract_string(a.event_json, '$.total') as bigint), 0) as total,
  coalesce(try_cast(json_extract_string(a.event_json, '$.wait_ms') as bigint), 0) as wait_ms,
  coalesce(try_cast(json_extract_string(a.event_json, '$.reduced_motion') as boolean), false)
    as reduced_motion
from events_dedup a
where a.event_name = 'adventure_objective_hud_arrived';

create or replace view adventure_objective_hud_summary as
select
  reduced_motion,
  count(*) as arrivals,
  quantile_cont(wait_ms, 0.5) as p50_wait_ms,
  quantile_cont(wait_ms, 0.95) as p95_wait_ms,
  max(wait_ms) as max_wait_ms,
  sum(delta) as jewels_presented
from adventure_objective_hud_wait
group by 1;

create or replace view adventure_fail_retry_near_goal as
with failures as (
  select
    installation_id,
    try_cast(event_timestamp as bigint) as fail_ts,
    try_cast(json_extract_string(event_json, '$.seasonId') as bigint) as season_id,
    try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) as level_index,
    coalesce(try_cast(json_extract_string(event_json, '$.attempt') as bigint), 0) as attempt,
    json_extract_string(event_json, '$.objective') as objective,
    coalesce(try_cast(json_extract_string(event_json, '$.current') as bigint), 0) as current,
    coalesce(try_cast(json_extract_string(event_json, '$.target') as bigint), 0) as target,
    coalesce(try_cast(json_extract_string(event_json, '$.remaining') as bigint), 0) as remaining
  from events_dedup
  where event_name = 'adventure_level_fail'
), starts as (
  select
    installation_id,
    try_cast(event_timestamp as bigint) as start_ts,
    try_cast(json_extract_string(event_json, '$.seasonId') as bigint) as season_id,
    try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) as level_index,
    coalesce(try_cast(json_extract_string(event_json, '$.attempt') as bigint), 0) as attempt
  from events_dedup
  where event_name = 'adventure_level_start'
)
select
  f.*,
  f.remaining <= greatest(1, ceil(f.target * 0.2)) as near_goal,
  exists (
    select 1 from starts s
    where s.installation_id = f.installation_id
      and s.season_id = f.season_id
      and s.level_index = f.level_index
      and s.attempt > f.attempt
      and s.start_ts > f.fail_ts
  ) as retried
from failures f;

create or replace view adventure_first_five_level_funnel as
with starts as (
  select
    installation_id,
    try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) as level_index,
    count(*) as attempts
  from events_dedup
  where event_name = 'adventure_level_start'
    and try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) between 0 and 4
  group by 1, 2
), wins as (
  select
    installation_id,
    try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) as level_index,
    count(*) as wins
  from events_dedup
  where event_name = 'adventure_level_win'
    and try_cast(json_extract_string(event_json, '$.levelIndex') as bigint) between 0 and 4
  group by 1, 2
)
select
  s.level_index,
  sum(s.attempts) as attempts,
  sum(coalesce(w.wins, 0)) as wins,
  sum(coalesce(w.wins, 0))::double / nullif(sum(s.attempts), 0) as wins_per_attempt
from starts s
left join wins w using (installation_id, level_index)
group by 1
order by 1;
