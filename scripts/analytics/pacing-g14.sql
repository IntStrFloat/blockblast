-- G14 input/result readiness and presentation conflict metrics.

create or replace view turn_input_ready_facts as
select
  installation_id,
  json_extract_string(event_json, '$.run_id') as run_id,
  json_extract_string(event_json, '$.mode') as mode,
  coalesce(try_cast(json_extract_string(event_json, '$.elapsed_ms') as bigint), 0) as elapsed_ms,
  coalesce(try_cast(json_extract_string(event_json, '$.new_tray') as boolean), false) as new_tray,
  json_extract_string(event_json, '$.readiness_source') as readiness_source,
  coalesce(try_cast(json_extract_string(event_json, '$.cleared_lines') as bigint), 0) as cleared_lines
from events_dedup
where event_name = 'turn_input_ready';

create or replace view turn_input_ready_summary as
select
  mode,
  new_tray,
  readiness_source,
  cleared_lines > 0 as cleared,
  count(*) as turns,
  quantile_cont(elapsed_ms, 0.5) as p50_ms,
  quantile_cont(elapsed_ms, 0.95) as p95_ms,
  quantile_cont(elapsed_ms, 0.99) as p99_ms
from turn_input_ready_facts
group by 1, 2, 3, 4;

create or replace view adventure_result_ready_summary as
select
  json_extract_string(event_json, '$.objective') as objective,
  coalesce(try_cast(json_extract_string(event_json, '$.reduced_motion') as boolean), false)
    as reduced_motion,
  coalesce(try_cast(json_extract_string(event_json, '$.accelerated') as boolean), false)
    as accelerated,
  count(*) as wins,
  quantile_cont(
    coalesce(try_cast(json_extract_string(event_json, '$.elapsed_ms') as bigint), 0),
    0.95
  ) as p95_win_to_result_ms
from events_dedup
where event_name = 'adventure_result_ready'
group by 1, 2, 3;

create or replace view effect_conflict_summary as
select
  json_extract_string(event_json, '$.mode') as mode,
  count(*) as conflicts,
  avg(coalesce(try_cast(json_extract_string(event_json, '$.clear_presentations') as bigint), 0))
    as avg_clear_presentations,
  avg(coalesce(try_cast(json_extract_string(event_json, '$.placement_presentations') as bigint), 0))
    as avg_placement_presentations
from events_dedup
where event_name = 'effect_conflict'
group by 1;
