-- Add public_form to BackofficeLeadOrigin enum
ALTER TYPE "backoffice_lead_origin" ADD VALUE IF NOT EXISTS 'public_form';
