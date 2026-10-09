-- G13 helper eligibility -> shown -> used funnel.

create or replace view helper_funnel_facts as
select
  installation_id,
  try_cast(event_timestamp as bigint) as event_ts,
  json_extract_string(event_json, '$.run_id') as run_id,
  json_extract_string(event_json, '$.helper') as helper,
  json_extract_string(event_json, '$.stage') as stage,
  json_extract_string(event_json, '$.source') as source,
  coalesce(try_cast(json_extract_string(event_json, '$.remaining_charges') as bigint), 0)
    as remaining_charges
from events_dedup
where event_name = 'helper_funnel';

create or replace view helper_funnel_summary as
select
  helper,
  source,
  count(*) filter (where stage = 'eligible') as eligible,
  count(*) filter (where stage = 'shown') as shown,
  count(*) filter (where stage = 'used') as used,
  count(*) filter (where stage = 'used')::double
    / nullif(count(*) filter (where stage = 'shown'), 0) as shown_to_used
from helper_funnel_facts
group by 1, 2;

create or replace view helper_exit_from_difficulty as
with uses as (
  select installation_id, run_id, helper, min(event_ts) as used_ts
  from helper_funnel_facts
  where stage = 'used'
  group by 1, 2, 3
), later_clear as (
  select
    installation_id,
    json_extract_string(event_json, '$.run_id') as run_id,
    min(try_cast(event_timestamp as bigint)) as clear_ts
  from events_dedup
  where event_name = 'first_independent_clear'
  group by 1, 2
)
select
  u.*,
  c.clear_ts is not null and c.clear_ts > u.used_ts as later_independent_clear,
  (c.clear_ts - u.used_ts) / 1000.0 as seconds_helper_to_clear
from uses u
left join later_clear c using (installation_id, run_id);
