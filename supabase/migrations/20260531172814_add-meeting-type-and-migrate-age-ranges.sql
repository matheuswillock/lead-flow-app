-- Add meetingType column to leads
ALTER TABLE public.corretor_studio_leads
  ADD COLUMN IF NOT EXISTS "meetingType" text;

-- Add meetingType column to leads schedule
ALTER TABLE public.corretor_studio_leads_schedule
  ADD COLUMN IF NOT EXISTS "meetingType" text;

-- Migrate existing age data from comma-separated ages to range:count format
-- Only processes rows that match the old format (digits, commas, spaces only)
-- Already-migrated rows (containing underscore from range keys) are excluded
UPDATE public.corretor_studio_leads
SET age = subq.new_age
FROM (
  SELECT
    lead_id,
    string_agg(range_key || ':' || cnt::text, ',' ORDER BY range_key) AS new_age
  FROM (
    SELECT
      l.id AS lead_id,
      CASE
        WHEN v BETWEEN 0 AND 18 THEN '00_18'
        WHEN v BETWEEN 19 AND 23 THEN '19_23'
        WHEN v BETWEEN 24 AND 28 THEN '24_28'
        WHEN v BETWEEN 29 AND 33 THEN '29_33'
        WHEN v BETWEEN 34 AND 38 THEN '34_38'
        WHEN v BETWEEN 39 AND 43 THEN '39_43'
        WHEN v BETWEEN 44 AND 48 THEN '44_48'
        WHEN v BETWEEN 49 AND 53 THEN '49_53'
        WHEN v BETWEEN 54 AND 58 THEN '54_58'
        WHEN v >= 59 THEN '59_plus'
      END AS range_key,
      count(*) AS cnt
    FROM public.corretor_studio_leads l
    CROSS JOIN LATERAL (
      SELECT trim(unnest)::int AS v
      FROM unnest(string_to_array(l.age, ','))
      WHERE trim(unnest) ~ '^\d+$'
    ) parsed
    WHERE l.age IS NOT NULL
      AND l.age ~ '^[0-9, ]+$'
      AND l.age !~ '_'
    GROUP BY l.id, range_key
  ) grouped
  WHERE range_key IS NOT NULL
  GROUP BY lead_id
) subq
WHERE public.corretor_studio_leads.id = subq.lead_id;
