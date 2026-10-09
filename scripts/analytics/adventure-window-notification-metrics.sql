-- Run after scripts/analytics/retention-baseline.sql.
-- G09 honest calendar-window freshness and notification return funnel.

create or replace view notification_attribution_facts as
select
  installation_id,
  event_name,
  try_cast(event_timestamp as bigint) as event_ts,
  json_extract_string(event_json, '$.attribution_id') as attribution_id,
  json_extract_string(event_json, '$.kind') as kind,
  json_extract_string(event_json, '$.route') as route,
  json_extract_string(event_json, '$.action') as action,
  json_extract_string(event_json, '$.product_session_id') as product_session_id
from events_dedup
where event_name in (
  'notification_opened',
  'notification_target_viewed',
  'notification_target_action'
);

create or replace view notification_target_funnel as
select
  installation_id,
  attribution_id,
  any_value(kind) as kind,
  min(event_ts) filter (where event_name = 'notification_opened') as opened_ts,
  min(event_ts) filter (where event_name = 'notification_target_viewed') as target_ts,
  min(event_ts) filter (where event_name = 'notification_target_action') as action_ts,
  any_value(route) filter (where event_name = 'notification_target_viewed') as route,
  any_value(action) filter (where event_name = 'notification_target_action') as action
from notification_attribution_facts
where attribution_id is not null
group by 1, 2;

create or replace view notification_return_rate as
select
  f.installation_id,
  f.attribution_id,
  f.kind,
  f.opened_ts,
  min(try_cast(e.event_timestamp as bigint)) as later_session_ts,
  min(try_cast(e.event_timestamp as bigint)) is not null as returned_later
from notification_target_funnel f
left join events_dedup e
  on e.installation_id = f.installation_id
  and e.event_name = 'session_started'
  and try_cast(e.event_timestamp as bigint) > f.opened_ts
  and try_cast(e.event_timestamp as bigint) <= f.opened_ts + 7 * 24 * 60 * 60 * 1000
where f.opened_ts is not null
group by 1, 2, 3, 4;

create or replace view notification_permission_outcomes as
select
  json_extract_string(event_json, '$.outcome') as outcome,
  json_extract_string(event_json, '$.local') as local_result,
  json_extract_string(event_json, '$.remote') as remote_result,
  count(*) as decisions
from events_dedup
where event_name = 'notification_permission_result'
group by 1, 2, 3;

create or replace view adventure_stale_countdown as
select
  json_extract_string(event_json, '$.reason') as reason,
  count(*) as stale_countdowns,
  count(distinct installation_id) as affected_installations
from events_dedup
where event_name = 'stale_countdown'
group by 1;
