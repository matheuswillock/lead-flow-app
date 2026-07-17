-- Add 'archived' to email_campaign_status enum
ALTER TYPE "public"."email_campaign_status" ADD VALUE IF NOT EXISTS 'archived';
