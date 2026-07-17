-- Default de fromEmail alinhado a deliveryby@corretorstudio.com
ALTER TABLE "public"."email_team_settings"
  ALTER COLUMN "fromEmail" SET DEFAULT 'deliveryby@corretorstudio.com';
