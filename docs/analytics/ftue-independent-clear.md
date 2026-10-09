# FTUE independent-clear experiment

Experiment id: `ftue-independent-clear-v1`  
Metric version: `independent-clear-v1`

The persisted assignment has two variants:

- `control`: the repaired one-move FTUE ends after the prepared clear.
- `independent_clear`: after the same prepared clear, the player sees one short rule,
  “Fill a row or column”, and continues with a normal three-piece tray.

`EXPO_PUBLIC_FTUE_VARIANT=control|independent_clear` is a development/QA override. Without
it, assignment is stable per install through the analytics experiment store. Exposure is
recorded only when the tutorial game is actually mounted.

## Intermediate metric

The canonical intermediate result is the `tutorial_metric_window_closed` event, not the
700 ms prepared-clear celebration and not the generic lifetime `first_independent_clear`
event.

`independent_clear = true` only when an accepted, non-highlighted placement clears at least
one row or column within accepted moves 1–10 after the prepared fixture clear. Accepted
highlighted moves consume the same ten-move budget. A clear that exactly follows the visible
recommendation is `assisted_clear` and does not satisfy the metric. The prepared clear is
`guided_success` and is move 0. Skip is retained as a separate property and does not remove
the player from measurement.

Every clear is also classified by `tutorial_clear_outcome` with the same experiment id,
variant, metric version, skip flag and post-fixture move index. Compare variants only when
`metric_version` matches. Follow-up outcomes are second run and mature calendar D1 cohorts;
the implementation does not imply or promise a retention increase.
