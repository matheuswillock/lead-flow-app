-- Rate limit persistente: janela rolante de 60s sobre OUTBOUND_MESSAGE por team.
CREATE INDEX IF NOT EXISTS "whatsapp_usage_events_teamId_eventType_createdAt_idx"
  ON "public"."whatsapp_usage_events" ("teamId", "eventType", "createdAt" DESC);
