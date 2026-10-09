-- Run after scripts/analytics/retention-baseline.sql.
-- G08 server entitlement -> claim receipt -> local G03 application.

create or replace view weekly_prize_event_facts as
select
  installation_id,
  event_name,
  try_cast(event_timestamp as bigint) as event_ts,
  json_extract_string(event_json, '$.reward_id') as reward_id,
  json_extract_string(event_json, '$.week_key') as week_key,
  try_cast(json_extract_string(event_json, '$.rank') as integer) as rank,
  json_extract_string(event_json, '$.result') as result,
  json_extract_string(event_json, '$.stage') as error_stage,
  json_extract_string(event_json, '$.code') as error_code
from events_dedup
where event_name in (
  'weekly_prize_eligible',
  'weekly_prize_claim_started',
  'weekly_prize_claim_result',
  'weekly_prize_applied',
  'weekly_prize_error'
);

create or replace view weekly_prize_funnel as
select
  installation_id,
  reward_id,
  any_value(week_key) as week_key,
  any_value(rank) as rank,
  min(event_ts) filter (where event_name = 'weekly_prize_eligible') as eligible_ts,
  min(event_ts) filter (
    where event_name = 'weekly_prize_claim_result' and result = 'claimed'
  ) as claimed_ts,
  min(event_ts) filter (where event_name = 'weekly_prize_applied') as applied_ts,
  count(*) filter (where event_name = 'weekly_prize_error') as errors
from weekly_prize_event_facts
where reward_id is not null
group by 1, 2;

create or replace view weekly_prize_rates as
select
  week_key,
  count(*) filter (where eligible_ts is not null) as eligible,
  count(*) filter (where claimed_ts is not null) as claimed,
  count(*) filter (where applied_ts is not null) as applied,
  count(*) filter (where claimed_ts is not null)::double
    / nullif(count(*) filter (where eligible_ts is not null), 0) as claim_per_eligible,
  count(*) filter (where applied_ts is not null)::double
    / nullif(count(*) filter (where claimed_ts is not null), 0) as applied_per_claim,
  sum(errors) as errors
from weekly_prize_funnel
group by 1;

create or replace view weekly_prize_claim_to_next_run as
select
  f.installation_id,
  f.reward_id,
  f.week_key,
  f.claimed_ts,
  min(try_cast(e.event_timestamp as bigint)) as next_run_ts,
  min(try_cast(e.event_timestamp as bigint)) is not null as started_next_run
from weekly_prize_funnel f
left join events_dedup e
  on e.installation_id = f.installation_id
  and e.event_name = 'run_started'
  and try_cast(e.event_timestamp as bigint) >= f.claimed_ts
where f.claimed_ts is not null
group by 1, 2, 3, 4;

select error_stage, error_code, count(*) as errors
from weekly_prize_event_facts
where event_name = 'weekly_prize_error'
group by 1, 2
order by errors desc;
