-- Backfill fullAccess=true for backoffice Managers (@corretorstudio.com).
-- Idempotent. Does not change brunageovana@corretorstudio.com (Operator).
-- Does not touch Gmail profiles or product Corretor Studio users.

UPDATE public.backoffice_users
SET "fullAccess" = true,
    "updatedAt" = now()
WHERE email IN (
  'matheuswillock@corretorstudio.com',
  'nathielewillock@corretorstudio.com',
  'bruno@corretorstudio.com',
  'eduarda@corretorstudio.com',
  'deborataytson@corretorstudio.com'
);
