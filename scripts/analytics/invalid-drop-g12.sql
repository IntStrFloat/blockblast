-- G12 invalid placement metrics. Run after retention-baseline.sql.

create or replace view invalid_drop_facts as
select
  installation_id,
  try_cast(event_timestamp as bigint) as event_ts,
  json_extract_string(event_json, '$.run_id') as run_id,
  json_extract_string(event_json, '$.mode') as mode,
  json_extract_string(event_json, '$.reason') as reason,
  coalesce(try_cast(json_extract_string(event_json, '$.streak') as bigint), 0) as streak,
  coalesce(try_cast(json_extract_string(event_json, '$.placement_index') as bigint), 0)
    as placement_index,
  json_extract_string(event_json, '$.shape_id') as shape_id
from events_dedup
where event_name = 'invalid_drop';

create or replace view invalid_drop_reason_summary as
select
  mode,
  reason,
  count(*) as events,
  count(distinct installation_id) as installations,
  avg(streak) as avg_streak,
  max(streak) as max_streak,
  count(*) filter (where placement_index <= 20) as events_first_20_moves
from invalid_drop_facts
group by 1, 2;

create or replace view invalid_drop_run_outcomes as
with invalid as (
  select
    installation_id,
    run_id,
    min(event_ts) as first_invalid_ts,
    max(streak) as max_invalid_streak,
    count(*) filter (where placement_index <= 20) as invalid_first_20
  from invalid_drop_facts
  group by 1, 2
), clears as (
  select
    installation_id,
    json_extract_string(event_json, '$.run_id') as run_id,
    min(try_cast(event_timestamp as bigint)) as first_clear_ts
  from events_dedup
  where event_name = 'first_independent_clear'
  group by 1, 2
), results as (
  select
    installation_id,
    json_extract_string(event_json, '$.run_id') as run_id,
    json_extract_string(event_json, '$.result') as result,
    json_extract_string(event_json, '$.reason') as result_reason
  from run_results
)
select
  i.*,
  c.first_clear_ts is not null as reached_independent_clear,
  (c.first_clear_ts - i.first_invalid_ts) / 1000.0 as seconds_invalid_to_clear,
  r.result,
  r.result_reason
from invalid i
left join clears c using (installation_id, run_id)
left join results r using (installation_id, run_id);
