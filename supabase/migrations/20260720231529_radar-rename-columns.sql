-- R2: Rename columns cdpSegmentSlug → radarSegmentSlug (2 tables) and cdpFieldKey → radarFieldKey
-- Idempotent via information_schema.columns guard

DO $$
BEGIN
  -- email_campaigns.cdpSegmentSlug → radarSegmentSlug
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'corretor_studio_email_campaigns'
      AND column_name = 'cdpSegmentSlug'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_campaigns"
      RENAME COLUMN "cdpSegmentSlug" TO "radarSegmentSlug";
  END IF;

  -- email_campaign_dispatches.cdpSegmentSlug → radarSegmentSlug
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'corretor_studio_email_campaign_dispatches'
      AND column_name = 'cdpSegmentSlug'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_campaign_dispatches"
      RENAME COLUMN "cdpSegmentSlug" TO "radarSegmentSlug";
  END IF;

  -- email_team_variables.cdpFieldKey → radarFieldKey
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_team_variables'
      AND column_name = 'cdpFieldKey'
  ) THEN
    ALTER TABLE "public"."email_team_variables"
      RENAME COLUMN "cdpFieldKey" TO "radarFieldKey";
  END IF;
END $$;
