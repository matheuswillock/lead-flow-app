-- Rename feature slug from 'configuration' to 'integration'
-- Idempotent: only runs if 'configuration' exists and 'integration' does not
UPDATE backoffice_features
SET slug = 'integration'
WHERE slug = 'configuration'
  AND NOT EXISTS (
    SELECT 1 FROM backoffice_features WHERE slug = 'integration'
  );
