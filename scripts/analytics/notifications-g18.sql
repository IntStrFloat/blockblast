-- G18 notification eligibility, OS permission and meaningful-return funnel.
-- Run after scripts/analytics/retention-baseline.sql.

create or replace view notification_g18_soft_ask_funnel as
with per_install as (
  select
    installation_id,
    max(case when event_name = 'notification_soft_ask_eligible' then 1 else 0 end)
      as eligible,
    max(case when event_name = 'notification_soft_ask_shown' then 1 else 0 end)
      as shown,
    max(case
      when event_name = 'notification_soft_ask_result'
       and json_extract_string(event_json, '$.result') = 'accepted'
      then 1 else 0 end) as soft_accepted,
    max(case
      when event_name = 'notification_permission_result'
       and json_extract_string(event_json, '$.source') = 'soft_ask'
       and json_extract_string(event_json, '$.outcome') = 'granted'
      then 1 else 0 end) as os_granted,
    max(case
      when event_name = 'notification_soft_ask_eligible'
      then json_extract_string(event_json, '$.last_meaningful_mode') end)
      as last_meaningful_mode
  from events_dedup
  where event_name in (
    'notification_soft_ask_eligible',
    'notification_soft_ask_shown',
    'notification_soft_ask_result',
    'notification_permission_result'
  )
  group by 1
)
select
  last_meaningful_mode,
  count(*) filter (where eligible = 1) as eligible_installs,
  count(*) filter (where shown = 1) as shown_installs,
  count(*) filter (where soft_accepted = 1) as soft_accepted_installs,
  count(*) filter (where os_granted = 1) as os_granted_installs,
  count(*) filter (where shown = 1)::double /
    nullif(count(*) filter (where eligible = 1), 0) as eligible_to_shown,
  count(*) filter (where os_granted = 1)::double /
    nullif(count(*) filter (where soft_accepted = 1), 0) as accepted_to_os_granted
from per_install
group by 1;

create or replace view notification_g18_permission_outcomes as
select
  json_extract_string(event_json, '$.source') as source,
  json_extract_string(event_json, '$.outcome') as outcome,
  count(*) as attempts,
  count(distinct installation_id) as installations
from events_dedup
where event_name = 'notification_permission_result'
group by 1, 2;

create or replace view notification_g18_meaningful_returns as
with opens as (
  select
    installation_id,
    json_extract_string(event_json, '$.attribution_id') as attribution_id,
    json_extract_string(event_json, '$.kind') as kind,
    json_extract_string(event_json, '$.route') as route,
    try_cast(event_timestamp as bigint) as opened_ts
  from events_dedup
  where event_name = 'notification_opened'
    and json_extract_string(event_json, '$.attribution_id') is not null
), actions as (
  select
    installation_id,
    json_extract_string(event_json, '$.attribution_id') as attribution_id,
    json_extract_string(event_json, '$.action') as action,
    coalesce(try_cast(json_extract_string(event_json, '$.elapsed_ms') as bigint), 0)
      as elapsed_ms
  from events_dedup
  where event_name = 'notification_target_action'
)
select
  o.kind,
  o.route,
  count(*) as opens,
  count(a.attribution_id) as meaningful_returns,
  count(a.attribution_id)::double / nullif(count(*), 0) as meaningful_return_rate,
  quantile_cont(a.elapsed_ms, 0.5) as p50_action_ms,
  quantile_cont(a.elapsed_ms, 0.95) as p95_action_ms
from opens o
left join actions a using (installation_id, attribution_id)
group by 1, 2;

create or replace view notification_g18_unsubscribes as
select
  json_extract_string(event_json, '$.source') as source,
  count(*) as unsubscribe_events,
  count(distinct installation_id) as installations
from events_dedup
where event_name = 'notification_unsubscribed'
group by 1;

-- These funnels describe eligibility, permission and attributed return.
-- They do not establish a retention effect before the first return; evaluate
-- D1/D7 only after mature cohorts and keep OS/platform permission bias visible.
