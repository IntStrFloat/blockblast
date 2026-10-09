-- DuckDB recipe. Put AppMetrica Logs API exports in ./exports and run:
--   duckdb retention.duckdb < scripts/analytics/retention-baseline.sql
-- Required files: installations.csv, events.csv, sessions_starts.csv.

create or replace view installations_raw as
select * from read_csv_auto('exports/installations.csv', header = true, all_varchar = true);

create or replace view events_raw as
select * from read_csv_auto('exports/events.csv', header = true, all_varchar = true);

create or replace view sessions_raw as
select * from read_csv_auto('exports/sessions_starts.csv', header = true, all_varchar = true);

-- event_id is the transport retry key. Keep the earliest receive of the same event.
create or replace view events_dedup as
select * exclude (dedupe_rank)
from (
  select *, row_number() over (
    partition by installation_id, coalesce(json_extract_string(event_json, '$.event_id'),
      event_name || ':' || event_timestamp || ':' || coalesce(session_id, ''))
    order by event_receive_timestamp
  ) as dedupe_rank
  from events_raw
)
where dedupe_rank = 1;

-- One canonical result per run. Later results win so a post-revive final can supersede
-- an earlier terminal surface without double-counting the run.
create or replace view run_results as
select * exclude (run_rank)
from (
  select *, row_number() over (
    partition by installation_id, json_extract_string(event_json, '$.run_id')
    order by try_cast(event_timestamp as bigint) desc, event_receive_timestamp desc
  ) as run_rank
  from events_dedup
  where event_name = 'run_result'
    and json_extract_string(event_json, '$.run_id') is not null
)
where run_rank = 1;

-- Canonical rewards: transport retry is already removed by event_id; this second key
-- prevents a remount/process retry from granting the same logical reward twice.
create or replace view rewards_dedup as
select * exclude (reward_rank)
from (
  select *, row_number() over (
    partition by
      installation_id,
      coalesce(
        json_extract_string(event_json, '$.completion_id'),
        json_extract_string(event_json, '$.run_id')
      ),
      json_extract_string(event_json, '$.reward_type'),
      coalesce(json_extract_string(event_json, '$.reward_id'), json_extract_string(event_json, '$.event_id'))
    order by event_receive_timestamp
  ) as reward_rank
  from events_dedup
  where event_name = 'reward_granted'
)
where reward_rank = 1;

create or replace view install_cohorts as
with first_modes as (
  select installation_id, mode as first_mode
  from (
    select
      installation_id,
      json_extract_string(event_json, '$.mode') as mode,
      row_number() over (partition by installation_id order by try_cast(event_timestamp as bigint)) as position
    from events_dedup
    where event_name = 'run_started'
      and json_extract_string(event_json, '$.context_status') = 'ready'
  )
  where position = 1
)
select
  i.installation_id,
  cast(install_datetime as timestamp)::date as cohort_date,
  app_version_name as first_launch_version,
  coalesce(nullif(tracker_name, ''), nullif(publisher_name, ''), 'organic_or_unknown') as acquisition_source,
  coalesce(device_type, 'unknown') as device_class,
  coalesce(first_mode, 'no_run') as first_mode
from installations_raw i
left join first_modes m using (installation_id)
where coalesce(lower(is_reinstallation), 'false') not in ('true', '1')
  and coalesce(lower(is_reattribution), 'false') not in ('true', '1');

-- Calendar-day retention. :as_of in the explanation is fixed here for reproducibility.
-- For 2026-09-19, D1 cohorts mature through 2026-09-18 and D7 through 2026-09-12.
create or replace table retention_baseline as
with session_days as (
  select distinct installation_id, cast(session_start_datetime as timestamp)::date as active_date
  from sessions_raw
), by_cohort as (
  select
    c.cohort_date,
    c.first_launch_version,
    c.acquisition_source,
    c.device_class,
    c.first_mode,
    count(distinct c.installation_id) as cohort_size,
    count(distinct case when s.active_date = c.cohort_date + interval 1 day then c.installation_id end) as d1_returns,
    count(distinct case when s.active_date = c.cohort_date + interval 7 day then c.installation_id end) as d7_returns
  from install_cohorts c
  left join session_days s using (installation_id)
  where c.cohort_date between date '2026-09-06' and date '2026-09-19'
  group by all
)
select *,
  case when cohort_date <= date '2026-09-18' then d1_returns::double / nullif(cohort_size, 0) end as d1,
  case when cohort_date <= date '2026-09-12' then d7_returns::double / nullif(cohort_size, 0) end as d7
from by_cohort;

-- Widget reconciliation: compare these weighted numerators/denominators with the UI.
select
  first_launch_version,
  sum(case when cohort_date <= date '2026-09-18' then cohort_size else 0 end) as d1_cohort_size,
  sum(case when cohort_date <= date '2026-09-18' then d1_returns else 0 end) as d1_returns,
  round(100.0 * sum(case when cohort_date <= date '2026-09-18' then d1_returns else 0 end)
    / nullif(sum(case when cohort_date <= date '2026-09-18' then cohort_size else 0 end), 0), 2) as d1_percent,
  sum(case when cohort_date <= date '2026-09-12' then cohort_size else 0 end) as d7_cohort_size,
  sum(case when cohort_date <= date '2026-09-12' then d7_returns else 0 end) as d7_returns,
  round(100.0 * sum(case when cohort_date <= date '2026-09-12' then d7_returns else 0 end)
    / nullif(sum(case when cohort_date <= date '2026-09-12' then cohort_size else 0 end), 0), 2) as d7_percent
from retention_baseline
group by first_launch_version
order by first_launch_version;

-- Diagnostic funnel. Steps are ordered per installation and never inferred from a later context.
create or replace view diagnostic_funnel as
with e as (
  select
    installation_id,
    event_name,
    try_cast(event_timestamp as bigint) as ts,
    json_extract_string(event_json, '$.run_id') as run_id,
    json_extract_string(event_json, '$.mode') as mode,
    json_extract_string(event_json, '$.product_session_id') as product_session_id,
    json_extract_string(event_json, '$.metric_version') as metric_version,
    json_extract_string(event_json, '$.variant') as experiment_variant,
    json_extract_string(event_json, '$.independent_clear') as independent_clear,
    json_extract_string(event_json, '$.skipped') as tutorial_skipped
  from events_dedup
  where json_extract_string(event_json, '$.context_status') = 'ready'
), run_starts as (
  select
    installation_id,
    run_id,
    any_value(mode) as mode,
    min(ts) as started_ts
  from e
  where event_name = 'run_started' and run_id is not null
  group by installation_id, run_id
), ranked_runs as (
  select *, row_number() over (partition by installation_id order by started_ts, run_id) as run_number
  from run_starts
), product_sessions as (
  select installation_id, product_session_id, min(ts) as started_ts
  from e
  where event_name = 'session_started' and product_session_id is not null
  group by installation_id, product_session_id
), ranked_sessions as (
  select *, row_number() over (partition by installation_id order by started_ts, product_session_id) as session_number
  from product_sessions
), raw_milestones as (
  select
    e.installation_id,
    min(case when event_name = 'piece_accepted' then ts end) as first_move_ts,
    min(case
      when event_name = 'tutorial_metric_window_closed'
        and metric_version = 'independent-clear-v1'
        and independent_clear = 'true'
      then ts
    end) as independent_clear_ts,
    max(case
      when event_name = 'tutorial_metric_window_closed'
        and metric_version = 'independent-clear-v1'
      then experiment_variant
    end) as ftue_variant,
    max(case
      when event_name = 'tutorial_metric_window_closed'
        and metric_version = 'independent-clear-v1'
      then tutorial_skipped
    end) as tutorial_skipped,
    any_value(r.started_ts) as second_run_ts,
    any_value(s.started_ts) as second_session_ts
  from e
  left join ranked_runs r on r.installation_id = e.installation_id and r.run_number = 2
  left join ranked_sessions s on s.installation_id = e.installation_id and s.session_number = 2
  group by e.installation_id
), milestones as (
  select
    installation_id,
    first_move_ts,
    ftue_variant,
    tutorial_skipped,
    case
      when independent_clear_ts >= first_move_ts then independent_clear_ts
    end as independent_clear_ts,
    case
      when independent_clear_ts >= first_move_ts and second_run_ts >= independent_clear_ts then second_run_ts
    end as second_run_ts,
    case
      when independent_clear_ts >= first_move_ts
        and second_run_ts >= independent_clear_ts
        and second_session_ts >= second_run_ts then second_session_ts
    end as second_session_ts
  from raw_milestones
)
select
  c.first_launch_version,
  c.acquisition_source,
  c.device_class,
  c.first_mode,
  coalesce(ftue_variant, 'unmeasured') as ftue_variant,
  coalesce(tutorial_skipped, 'false') as tutorial_skipped,
  count(*) as first_launch,
  count(first_move_ts) as first_move,
  count(independent_clear_ts) as independent_clear,
  count(second_run_ts) as second_run,
  count(second_session_ts) as second_session
from install_cohorts c
left join milestones m using (installation_id)
group by all;
