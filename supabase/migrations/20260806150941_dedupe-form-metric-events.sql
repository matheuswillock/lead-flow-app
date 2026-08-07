-- Step 1: intra-publication duplicates
DELETE FROM "public"."corretor_studio_public_form_metric_events" AS duplicate
USING "public"."corretor_studio_public_form_metric_events" AS keeper
WHERE duplicate."eventType" IN (
    'form_completed'::public."PublicFormMetricType",
    'lead_created'::public."PublicFormMetricType",
    'lead_attached'::public."PublicFormMetricType",
    'meeting_scheduled'::public."PublicFormMetricType"
  )
  AND keeper."eventType" = duplicate."eventType"
  AND keeper."publicationId" = duplicate."publicationId"
  AND keeper."visitorSessionId" = duplicate."visitorSessionId"
  AND (
    keeper."createdAt" < duplicate."createdAt"
    OR (
      keeper."createdAt" = duplicate."createdAt"
      AND keeper."id" < duplicate."id"
    )
  );

-- Step 2: cross-publication collisions on the stable eventKey shape
DELETE FROM "public"."corretor_studio_public_form_metric_events" AS duplicate
USING "public"."corretor_studio_public_form_metric_events" AS keeper
WHERE duplicate."eventType" IN (
    'form_completed'::public."PublicFormMetricType",
    'lead_created'::public."PublicFormMetricType",
    'lead_attached'::public."PublicFormMetricType",
    'meeting_scheduled'::public."PublicFormMetricType"
  )
  AND keeper."eventType" = duplicate."eventType"
  AND keeper."visitorSessionId" = duplicate."visitorSessionId"
  AND keeper."id" <> duplicate."id"
  AND (
    keeper."createdAt" < duplicate."createdAt"
    OR (
      keeper."createdAt" = duplicate."createdAt"
      AND keeper."id" < duplicate."id"
    )
  );

-- Step 3: normalize remaining keys to the stable contract used by the app
UPDATE "public"."corretor_studio_public_form_metric_events"
SET "eventKey" = "visitorSessionId" || ':' || "eventType"::text
WHERE "eventType" IN (
    'form_completed'::public."PublicFormMetricType",
    'lead_created'::public."PublicFormMetricType",
    'lead_attached'::public."PublicFormMetricType",
    'meeting_scheduled'::public."PublicFormMetricType"
  )
  AND "eventKey" IS DISTINCT FROM ("visitorSessionId" || ':' || "eventType"::text);
