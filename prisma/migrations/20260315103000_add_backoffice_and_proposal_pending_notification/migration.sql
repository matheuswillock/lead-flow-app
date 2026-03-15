-- Add new user role: backoffice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'backoffice'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'backoffice';
  END IF;
END$$;

-- Add notification type for proposal pending alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'LEAD_PROPOSAL_PENDING'
  ) THEN
    ALTER TYPE "notification_type" ADD VALUE 'LEAD_PROPOSAL_PENDING';
  END IF;
END$$;
