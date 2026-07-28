-- WhatsApp Inbox V3 Phase 4: message actions (quote/delete columns + reaction/favorite/pin/visibility/commands).
-- Idempotent. Server-only tables: RLS on, revoke anon/authenticated, grant service_role.

-- Enums
DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageActionCommandKind" AS ENUM ('REACT', 'UNREACT', 'DELETE_FOR_EVERYONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageActionCommandStatus" AS ENUM ('PENDING', 'APPLIED', 'UNKNOWN', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Quote / delete-for-everyone columns on whatsapp_messages
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS "quotedMessageId" uuid,
  ADD COLUMN IF NOT EXISTS "quotedProviderMessageId" text,
  ADD COLUMN IF NOT EXISTS "deletedForEveryoneAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "deletedByProfileId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_quotedMessageId_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD CONSTRAINT "whatsapp_messages_quotedMessageId_fkey"
        FOREIGN KEY ("quotedMessageId") REFERENCES public.whatsapp_messages ("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_deletedByProfileId_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD CONSTRAINT "whatsapp_messages_deletedByProfileId_fkey"
        FOREIGN KEY ("deletedByProfileId") REFERENCES public.corretor_studio_profiles ("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "whatsapp_messages_quotedMessageId_idx"
  ON public.whatsapp_messages ("quotedMessageId");

-- Reactions
CREATE TABLE IF NOT EXISTS public.whatsapp_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES public.corretor_studio_teams ("id") ON DELETE CASCADE,
  "messageId" uuid NOT NULL REFERENCES public.whatsapp_messages ("id") ON DELETE CASCADE,
  "profileId" uuid REFERENCES public.corretor_studio_profiles ("id") ON DELETE SET NULL,
  "actorPhone" text,
  emoji text NOT NULL,
  "providerReactionId" text,
  "removedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "whatsapp_message_reactions_messageId_removedAt_idx"
  ON public.whatsapp_message_reactions ("messageId", "removedAt");

CREATE INDEX IF NOT EXISTS "whatsapp_message_reactions_teamId_createdAt_idx"
  ON public.whatsapp_message_reactions ("teamId", "createdAt");

-- Favorites (private per profile)
CREATE TABLE IF NOT EXISTS public.whatsapp_message_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES public.corretor_studio_teams ("id") ON DELETE CASCADE,
  "messageId" uuid NOT NULL REFERENCES public.whatsapp_messages ("id") ON DELETE CASCADE,
  "profileId" uuid NOT NULL REFERENCES public.corretor_studio_profiles ("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_message_favorites_messageId_profileId_key" UNIQUE ("messageId", "profileId")
);

CREATE INDEX IF NOT EXISTS "whatsapp_message_favorites_teamId_profileId_idx"
  ON public.whatsapp_message_favorites ("teamId", "profileId");

-- Pins (shared in conversation)
CREATE TABLE IF NOT EXISTS public.whatsapp_message_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES public.corretor_studio_teams ("id") ON DELETE CASCADE,
  "conversationId" uuid NOT NULL REFERENCES public.whatsapp_conversations ("id") ON DELETE CASCADE,
  "messageId" uuid NOT NULL REFERENCES public.whatsapp_messages ("id") ON DELETE CASCADE,
  "pinnedByProfileId" uuid NOT NULL REFERENCES public.corretor_studio_profiles ("id") ON DELETE CASCADE,
  "pinnedAt" timestamptz NOT NULL DEFAULT now(),
  "expiresAt" timestamptz,
  "removedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "whatsapp_message_pins_conversationId_removedAt_idx"
  ON public.whatsapp_message_pins ("conversationId", "removedAt");

CREATE INDEX IF NOT EXISTS "whatsapp_message_pins_messageId_removedAt_idx"
  ON public.whatsapp_message_pins ("messageId", "removedAt");

-- Visibility ("delete for me")
CREATE TABLE IF NOT EXISTS public.whatsapp_message_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES public.corretor_studio_teams ("id") ON DELETE CASCADE,
  "messageId" uuid NOT NULL REFERENCES public.whatsapp_messages ("id") ON DELETE CASCADE,
  "profileId" uuid NOT NULL REFERENCES public.corretor_studio_profiles ("id") ON DELETE CASCADE,
  "hiddenAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_message_visibility_messageId_profileId_key" UNIQUE ("messageId", "profileId")
);

CREATE INDEX IF NOT EXISTS "whatsapp_message_visibility_teamId_profileId_idx"
  ON public.whatsapp_message_visibility ("teamId", "profileId");

-- Action commands (external: react / unreact / delete for everyone)
CREATE TABLE IF NOT EXISTS public.whatsapp_message_action_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES public.corretor_studio_teams ("id") ON DELETE CASCADE,
  "messageId" uuid NOT NULL REFERENCES public.whatsapp_messages ("id") ON DELETE CASCADE,
  "profileId" uuid NOT NULL REFERENCES public.corretor_studio_profiles ("id") ON DELETE CASCADE,
  "clientActionId" text NOT NULL,
  kind "WhatsAppMessageActionCommandKind" NOT NULL,
  status "WhatsAppMessageActionCommandStatus" NOT NULL DEFAULT 'PENDING',
  "requestHash" text,
  emoji text,
  "attemptCount" integer NOT NULL DEFAULT 0,
  "claimedAt" timestamptz,
  "lastError" text,
  "reconciledAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_message_action_commands_teamId_clientActionId_key" UNIQUE ("teamId", "clientActionId")
);

CREATE INDEX IF NOT EXISTS "whatsapp_message_action_commands_messageId_kind_status_idx"
  ON public.whatsapp_message_action_commands ("messageId", kind, status);

-- RLS + grants (server-only)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'whatsapp_message_reactions',
    'whatsapp_message_favorites',
    'whatsapp_message_pins',
    'whatsapp_message_visibility',
    'whatsapp_message_action_commands'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;
