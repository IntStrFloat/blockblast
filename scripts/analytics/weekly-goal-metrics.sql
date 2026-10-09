-- Run after scripts/analytics/retention-baseline.sql.
-- G07: immutable weekly-goal funnel and return-loop diagnostics.

create or replace view weekly_goal_events as
select
  installation_id,
  event_name,
  try_cast(event_timestamp as bigint) as event_ts,
  json_extract_string(event_json, '$.goal_id') as goal_id,
  json_extract_string(event_json, '$.week_key') as week_key,
  try_cast(json_extract_string(event_json, '$.target') as bigint) as target,
  try_cast(json_extract_string(event_json, '$.current') as bigint) as current,
  json_extract_string(event_json, '$.source') as source
from events_dedup
where event_name in (
  'weekly_goal_assigned',
  'weekly_goal_exposed',
  'weekly_goal_completed'
);

create or replace view weekly_goal_funnel as
with per_goal as (
  select
    installation_id,
    goal_id,
    any_value(week_key) as week_key,
    max(target) filter (where event_name = 'weekly_goal_assigned') as assigned_target,
    min(event_ts) filter (where event_name = 'weekly_goal_assigned') as assigned_ts,
    min(event_ts) filter (where event_name = 'weekly_goal_exposed') as exposed_ts,
    min(event_ts) filter (where event_name = 'weekly_goal_completed') as completed_ts,
    max(current) filter (where event_name = 'weekly_goal_completed') as completed_current,
    count(distinct target) filter (
      where event_name in ('weekly_goal_assigned', 'weekly_goal_exposed', 'weekly_goal_completed')
    ) as distinct_targets
  from weekly_goal_events
  where goal_id is not null
  group by 1, 2
)
select *,
  exposed_ts is not null as exposed,
  completed_ts is not null as completed,
  case when assigned_ts is not null and completed_ts is not null
    then (completed_ts - assigned_ts) / 1000.0 end as seconds_to_complete,
  distinct_targets = 1 as immutable_target
from per_goal;

create or replace view weekly_goal_completion_rate as
select
  week_key,
  count(*) filter (where assigned_ts is not null) as assigned,
  count(*) filter (where completed_ts is not null) as completed,
  count(*) filter (where completed_ts is not null)::double
    / nullif(count(*) filter (where assigned_ts is not null), 0) as completed_per_assigned,
  count(*) filter (where not immutable_target) as target_contract_violations
from weekly_goal_funnel
group by 1;

-- A next_run carrying the completed goal_id proves another game was started
-- after the completion CTA. The generic next-goal coordinator supplies the id.
create or replace view weekly_goal_post_completion_replay as
select
  f.installation_id,
  f.goal_id,
  f.week_key,
  f.completed_ts,
  min(try_cast(e.event_timestamp as bigint)) as next_run_ts,
  min(try_cast(e.event_timestamp as bigint)) is not null as replayed_after_completion
from weekly_goal_funnel f
left join events_dedup e
  on e.installation_id = f.installation_id
  and e.event_name = 'next_run'
  and json_extract_string(e.event_json, '$.goal_id') = f.goal_id
  and try_cast(e.event_timestamp as bigint) >= f.completed_ts
where f.completed_ts is not null
group by 1, 2, 3, 4;

-- Participation requires a goal-attributed run start, not merely opening a
-- screen that exposed the goal.
create or replace view weekly_goal_second_week_participation as
with participated_weeks as (
  select distinct
    g.installation_id,
    g.week_key
  from weekly_goal_events g
  join events_dedup e
    on e.installation_id = g.installation_id
    and e.event_name = 'next_run'
    and json_extract_string(e.event_json, '$.goal_id') = g.goal_id
    and try_cast(e.event_timestamp as bigint) >= g.event_ts
  where g.event_name = 'weekly_goal_assigned'
    and g.week_key is not null
), ranked as (
  select *, row_number() over (
    partition by installation_id order by week_key
  ) as participation_week
  from participated_weeks
)
select
  installation_id,
  count(*) as participated_weeks,
  max(participation_week) >= 2 as participated_second_week
from ranked
group by 1;
