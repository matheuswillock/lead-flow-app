-- Add 'suppressed' to email_event_type enum
ALTER TYPE "public"."email_event_type" ADD VALUE IF NOT EXISTS 'suppressed';

-- Add 'suppressed' to email_log_status enum
ALTER TYPE "public"."email_log_status" ADD VALUE IF NOT EXISTS 'suppressed';
