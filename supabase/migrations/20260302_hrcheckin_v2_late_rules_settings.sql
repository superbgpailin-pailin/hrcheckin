-- HR CheckIn v2: seed configurable late-rules in settings JSON
-- Date: 2026-03-02

begin;

update public.settings
set config = jsonb_set(
  config,
  '{lateRules}',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'late-0-5',
      'label', 'สาย 0-5 นาที',
      'minMinutes', 0,
      'maxMinutes', 5,
      'deductionAmount', 0,
      'monthlyAccumulatedMinutesThreshold', 30,
      'monthlyAccumulatedDeduction', 500
    ),
    jsonb_build_object(
      'id', 'late-6-10',
      'label', 'สาย 6-10 นาที',
      'minMinutes', 6,
      'maxMinutes', 10,
      'deductionAmount', 100,
      'monthlyAccumulatedMinutesThreshold', null,
      'monthlyAccumulatedDeduction', null
    ),
    jsonb_build_object(
      'id', 'late-11-20',
      'label', 'สาย 11-20 นาที',
      'minMinutes', 11,
      'maxMinutes', 20,
      'deductionAmount', 200,
      'monthlyAccumulatedMinutesThreshold', null,
      'monthlyAccumulatedDeduction', null
    ),
    jsonb_build_object(
      'id', 'late-21-30',
      'label', 'สาย 21-30 นาที',
      'minMinutes', 21,
      'maxMinutes', 30,
      'deductionAmount', 300,
      'monthlyAccumulatedMinutesThreshold', null,
      'monthlyAccumulatedDeduction', null
    ),
    jsonb_build_object(
      'id', 'late-31-plus',
      'label', 'สายเกิน 30 นาที',
      'minMinutes', 31,
      'maxMinutes', null,
      'deductionAmount', 500,
      'monthlyAccumulatedMinutesThreshold', null,
      'monthlyAccumulatedDeduction', null
    )
  ),
  true
)
where id = 'checkin_v2'
  and (
    config -> 'lateRules' is null
    or jsonb_typeof(config -> 'lateRules') <> 'array'
    or jsonb_array_length(config -> 'lateRules') = 0
  );

commit;
