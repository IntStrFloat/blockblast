# Retention baseline and export recipe

## Contract

- `entry_source` is the way the current **product session** started (`organic`, notification, or deeplink). It is not acquisition attribution.
- Acquisition source comes only from the AppMetrica installations export (`tracker_name`, `publisher_name`, tracking parameters). Never backfill it from session entry.
- AppMetrica SDK sessions and `product_session_id` are different clocks. AppMetrica keeps its built-in automatic SDK lifecycle; the app pauses only its product run/session clock. A product session survives a background shorter than 30 minutes; at or beyond 30 minutes the previous run is finalized as `background_timeout` when the app next becomes active. Missing pause metadata on the next process start is `process_death`, not an invented exit time.
- `lifetime_games` and `session_games` are separate. `session_games` resets only when a new product session starts.
- Queue retry replays the frozen envelope. `event_id`, `run_id`, product session, app version, build, schema and config version must not be rewritten.
- A pre-context event is exported as `context_status=bootstrap_unattributed` with no historical session/app attribution. It is excluded from attribution funnels.

## Export

Use AppMetrica **Data export → Save to file** or Logs API and export the same timezone/date dimension for all three entities:

1. `installations.csv`: `installation_id,install_datetime,is_reinstallation,is_reattribution,tracker_name,publisher_name,device_type,app_version_name,app_build_number`.
2. `events.csv`: `installation_id,event_name,event_json,event_timestamp,event_receive_timestamp,event_datetime,event_receive_datetime,session_id,app_version_name,app_build_number,device_type`.
3. `sessions_starts.csv`: `installation_id,session_id,session_start_datetime,session_start_timestamp,app_version_name,app_build_number,device_type`.

Place them in `exports/` and run:

```powershell
Get-Content -Raw scripts/analytics/retention-baseline.sql | duckdb retention.duckdb
```

The SQL deduplicates transport retries by `event_id`, selects one canonical `run_result` per `run_id`, separates actual installs from updates/reinstallations, produces the funnel `first launch → first move → independent clear → second run → second product session`, and calculates calendar D1/D7 by first-launch version, acquisition source, mode (from events), and device class.

## Version 1.1.38, September 6–19

- Treat `1.1.38` as the first-launch version only when the installation record itself has `app_version_name=1.1.38`. Existing installations whose events merely show `1.1.38` are updates and must not enter the new-install cohort.
- For an as-of date of September 19, D1 is mature only through the September 18 cohort and D7 only through September 12. Later cohorts stay null; they are not zeros.
- The supplied widget visibly shows `D1=17.61%` and `D7=5.39%`, but it does not show cohort sizes, return counts, period/filter controls or the calculation method. The rates are therefore observations, not yet independently confirmed. Confirmation requires exact cohort sizes, D1/D7 return counts, timezone, calendar-vs-24-hour method, minimum cohort size, audience filters, reinstallation/reattribution policy, and the widget's version dimension. The reconciliation query prints both numerators and denominators.
- A comparison with an overlapping quarter mixes versions, install/update populations and maturity windows. It must not be presented as proof that `1.1.38` caused a decline.

## Revenue limitation

The installed AppMetrica package supports `reportAdRevenue`, but the installed Yandex Mobile Ads React Native callback exposes an opaque impression payload rather than a documented typed price/currency contract. This implementation does not parse or estimate money from impressions. Revenue by variant/cohort is therefore **unavailable** until either a supported paid callback supplies price and ISO currency, or an agreed ad-network export is joined to AppMetrica installation/cohort and experiment exposure keys. Impression counts remain delivery metrics only.

## Experiment rule

`assignExperimentVariant` persists a stable per-install assignment. `recordExperimentExposure` must be called only inside the UI branch that actually rendered the changed experience. No experiment is currently declared active, so the app does not fabricate exposure or variant revenue.

## Required QA before using the baseline

- Offline → queued retry → process restart → app update preserves the original envelope.
- Opt-out clears unsent events and runtime identifiers, disables SDK sending, and records nothing new.
- Bootstrap events remain unattributed after initialization.
- Process death, short-background revive and repeated mounts emit at most one canonical result/reward after `event_id`/`run_id` dedupe.
- Compare AppMetrica event receive time with device event time to quantify late/offline delivery before closing a cohort.
