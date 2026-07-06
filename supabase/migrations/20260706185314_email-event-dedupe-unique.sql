-- Dedupe email events before adding unique constraint on (logId, type, occurredAt)

DELETE FROM "public"."corretor_studio_email_events" a
USING "public"."corretor_studio_email_events" b
WHERE a."id" > b."id"
  AND a."logId" = b."logId"
  AND a."type" = b."type"
  AND a."occurredAt" = b."occurredAt";

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_events_logId_type_occurredAt_key"
  ON "public"."corretor_studio_email_events" ("logId", "type", "occurredAt");
