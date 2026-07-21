-- WhatsApp conversation tags (Estágio 3)

CREATE TABLE IF NOT EXISTS "public"."whatsapp_conversation_tags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_conversation_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."whatsapp_conversation_tag_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "tagId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_conversation_tag_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_conversation_tags_teamId_name_key"
  ON "public"."whatsapp_conversation_tags" ("teamId", "name");

CREATE INDEX IF NOT EXISTS "whatsapp_conversation_tags_teamId_sortOrder_idx"
  ON "public"."whatsapp_conversation_tags" ("teamId", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_conversation_tag_assignments_conversationId_tagId_key"
  ON "public"."whatsapp_conversation_tag_assignments" ("conversationId", "tagId");

CREATE INDEX IF NOT EXISTS "whatsapp_conversation_tag_assignments_tagId_idx"
  ON "public"."whatsapp_conversation_tag_assignments" ("tagId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversation_tags_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversation_tags"
      ADD CONSTRAINT "whatsapp_conversation_tags_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversation_tag_assignments_conversationId_fkey'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversation_tag_assignments"
      ADD CONSTRAINT "whatsapp_conversation_tag_assignments_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "public"."whatsapp_conversations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversation_tag_assignments_tagId_fkey'
  ) THEN
    ALTER TABLE "public"."whatsapp_conversation_tag_assignments"
      ADD CONSTRAINT "whatsapp_conversation_tag_assignments_tagId_fkey"
      FOREIGN KEY ("tagId") REFERENCES "public"."whatsapp_conversation_tags"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
