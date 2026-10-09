-- G17 interstitial policy experiment.
-- Run after scripts/analytics/retention-baseline.sql.
-- Primary analysis is intention-to-treat over every assigned installation.

create or replace view interstitial_g17_assignments as
select * exclude (assignment_rank)
from (
  select
    installation_id,
    json_extract_string(event_json, '$.variant') as variant,
    try_cast(event_timestamp as bigint) as assigned_ts,
    row_number() over (
      partition by installation_id
      order by try_cast(event_timestamp as bigint), event_receive_timestamp
    ) as assignment_rank
  from events_dedup
  where event_name = 'experiment_assignment'
    and json_extract_string(event_json, '$.experiment_id') =
      'interstitial-first-session-v1'
    and json_extract_string(event_json, '$.enrollment') = 'new_install'
)
where assignment_rank = 1;

create or replace view interstitial_g17_itt_retention as
with session_days as (
  select distinct
    installation_id,
    cast(session_start_datetime as timestamp)::date as active_date
  from sessions_raw
), assigned as (
  select
    a.installation_id,
    a.variant,
    c.cohort_date,
    c.first_launch_version,
    c.acquisition_source,
    c.device_class
  from interstitial_g17_assignments a
  join install_cohorts c using (installation_id)
), summary as (
  select
    a.variant,
    a.cohort_date,
    a.first_launch_version,
    a.acquisition_source,
    a.device_class,
    count(distinct a.installation_id) as assigned_installs,
    count(distinct case
      when s.active_date = a.cohort_date + interval 1 day then a.installation_id
    end) as d1_returns,
    count(distinct case
      when s.active_date = a.cohort_date + interval 7 day then a.installation_id
    end) as d7_returns
  from assigned a
  left join session_days s using (installation_id)
  group by all
)
select *,
  case when cohort_date <= current_date - interval 1 day
    then d1_returns::double / nullif(assigned_installs, 0) end as d1,
  case when cohort_date <= current_date - interval 7 day
    then d7_returns::double / nullif(assigned_installs, 0) end as d7
from summary;

create or replace view interstitial_g17_second_session as
with sessions as (
  select
    installation_id,
    count(distinct product_session_id) as product_sessions
  from (
    select
      installation_id,
      json_extract_string(event_json, '$.product_session_id') as product_session_id
    from events_dedup
    where event_name = 'session_started'
  )
  where product_session_id is not null
  group by 1
)
select
  a.variant,
  count(*) as assigned_installs,
  count(*) filter (where coalesce(s.product_sessions, 0) >= 2) as second_session_installs,
  count(*) filter (where coalesce(s.product_sessions, 0) >= 2)::double /
    nullif(count(*), 0) as second_session_rate
from interstitial_g17_assignments a
left join sessions s using (installation_id)
group by 1;

create or replace view interstitial_g17_policy_funnel as
select
  json_extract_string(event_json, '$.variant') as variant,
  json_extract_string(event_json, '$.mode') as mode,
  json_extract_string(event_json, '$.placement') as placement,
  json_extract_string(event_json, '$.decision') as decision,
  count(*) as opportunities,
  quantile_cont(
    coalesce(try_cast(json_extract_string(event_json, '$.active_play_ms') as bigint), 0),
    0.5
  ) as p50_active_play_ms,
  quantile_cont(
    coalesce(try_cast(json_extract_string(event_json, '$.active_play_ms') as bigint), 0),
    0.95
  ) as p95_active_play_ms,
  avg(coalesce(try_cast(json_extract_string(event_json, '$.session_depth') as bigint), 0))
    as avg_session_depth
from events_dedup
where event_name = 'interstitial_policy_eligible'
group by 1, 2, 3, 4;

create or replace view interstitial_g17_delivery as
with raw as (
  select
    installation_id,
    event_name,
    json_extract_string(event_json, '$.load_id') as load_id,
    json_extract_string(event_json, '$.attempt_id') as attempt_id,
    json_extract_string(event_json, '$.variant') as variant,
    json_extract_string(event_json, '$.mode') as mode,
    json_extract_string(event_json, '$.placement') as placement
  from events_dedup
  where event_name in (
      'ad_load_requested', 'ad_requested', 'ad_loaded', 'ad_shown',
      'ad_dismissed', 'ad_failed', 'ad_result'
    )
    and json_extract_string(event_json, '$.format') = 'interstitial'
), load_context as (
  select
    installation_id,
    load_id,
    max(variant) filter (where variant is not null) as variant,
    max(mode) filter (where mode is not null) as mode
  from raw
  where load_id is not null
  group by 1, 2
)
select
  coalesce(r.variant, l.variant) as variant,
  r.event_name,
  coalesce(r.mode, l.mode) as mode,
  r.placement,
  count(*) as events,
  count(distinct r.attempt_id) as attempts
from raw r
left join load_context l using (installation_id, load_id)
where coalesce(r.variant, l.variant) is not null
group by 1, 2, 3, 4;

create or replace view interstitial_g17_frame_guardrail as
select
  a.variant,
  count(*) as samples,
  quantile_cont(
    coalesce(try_cast(json_extract_string(e.event_json, '$.p95_ms') as double), 0),
    0.95
  ) as p95_of_reported_frame_p95_ms,
  sum(coalesce(
    try_cast(json_extract_string(e.event_json, '$.dropped_frames') as bigint),
    0
  )) as dropped_frames
from interstitial_g17_assignments a
join events_dedup e using (installation_id)
where e.event_name = 'frame_budget_sample'
group by 1;

-- Revenue per assigned install at D7/D14 is intentionally absent here.
-- Current client ad events contain no verified monetary value. Join a verified
-- impression-revenue export to interstitial_g17_assignments before using the
-- revenue guardrail; ad_shown counts are not a revenue substitute.
-- Crash-free/ANR guardrails likewise come from the version+variant-linked
-- AppMetrica crash export, not from a quiet local event sample.
