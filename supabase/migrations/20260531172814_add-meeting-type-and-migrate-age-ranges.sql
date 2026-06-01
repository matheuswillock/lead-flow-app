-- Add meetingType column to leads
ALTER TABLE public.corretor_studio_leads
  ADD COLUMN IF NOT EXISTS "meetingType" text;

-- Add meetingType column to leads schedule
ALTER TABLE public.corretor_studio_leads_schedule
  ADD COLUMN IF NOT EXISTS "meetingType" text;

-- Migrate existing age data from old free-text lists (e.g. "30, 50, 60, 14, 18,")
-- to range:count format (e.g. "00_18:2,29_33:1,49_53:1,59_plus:1").
-- Idempotent: skips rows already in the new format (contains ":").
WITH parsed_tokens AS (
  SELECT
    l.id AS lead_id,
    regexp_split_to_table(l.age, '[^0-9]+') AS token
  FROM public.corretor_studio_leads l
  WHERE l.age IS NOT NULL
    AND btrim(l.age) <> ''
    AND l.age !~ ':'
),
parsed_ages AS (
  SELECT
    lead_id,
    token::int AS age_value
  FROM parsed_tokens
  WHERE token ~ '^\d+$'
),
ranged AS (
  SELECT
    lead_id,
    CASE
      WHEN age_value BETWEEN 0 AND 18 THEN '00_18'
      WHEN age_value BETWEEN 19 AND 23 THEN '19_23'
      WHEN age_value BETWEEN 24 AND 28 THEN '24_28'
      WHEN age_value BETWEEN 29 AND 33 THEN '29_33'
      WHEN age_value BETWEEN 34 AND 38 THEN '34_38'
      WHEN age_value BETWEEN 39 AND 43 THEN '39_43'
      WHEN age_value BETWEEN 44 AND 48 THEN '44_48'
      WHEN age_value BETWEEN 49 AND 53 THEN '49_53'
      WHEN age_value BETWEEN 54 AND 58 THEN '54_58'
      WHEN age_value >= 59 THEN '59_plus'
      ELSE NULL
    END AS range_key
  FROM parsed_ages
),
counted AS (
  SELECT
    lead_id,
    range_key,
    count(*)::int AS cnt
  FROM ranged
  WHERE range_key IS NOT NULL
  GROUP BY lead_id, range_key
),
serialized AS (
  SELECT
    lead_id,
    string_agg(range_key || ':' || cnt::text, ',' ORDER BY range_key) AS new_age
  FROM counted
  GROUP BY lead_id
)
UPDATE public.corretor_studio_leads AS l
SET age = s.new_age
FROM serialized s
WHERE l.id = s.lead_id
  AND l.age IS DISTINCT FROM s.new_age;
