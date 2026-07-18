-- Migrate backoffice staff emails from @corretorstudio.com to @corretorstudio.com.br.
-- Idempotent. Only the 6 known production backoffice users (explicit list).
-- Updates: backoffice_users, corretor_studio_profiles, auth.users, auth.identities.

WITH email_map(old_email, new_email) AS (
  VALUES
    ('brunageovana@corretorstudio.com', 'brunageovana@corretorstudio.com.br'),
    ('bruno@corretorstudio.com', 'bruno@corretorstudio.com.br'),
    ('deborataytson@corretorstudio.com', 'deborataytson@corretorstudio.com.br'),
    ('eduarda@corretorstudio.com', 'eduarda@corretorstudio.com.br'),
    ('matheuswillock@corretorstudio.com', 'matheuswillock@corretorstudio.com.br'),
    ('nathielewillock@corretorstudio.com', 'nathielewillock@corretorstudio.com.br')
)
UPDATE public.backoffice_users AS bu
SET
  email = m.new_email,
  "mailboxAddress" = CASE
    WHEN bu."mailboxAddress" IS NOT NULL AND bu."mailboxAddress" = m.old_email THEN m.new_email
    ELSE bu."mailboxAddress"
  END,
  "updatedAt" = now()
FROM email_map AS m
WHERE bu.email = m.old_email;

WITH email_map(old_email, new_email) AS (
  VALUES
    ('brunageovana@corretorstudio.com', 'brunageovana@corretorstudio.com.br'),
    ('bruno@corretorstudio.com', 'bruno@corretorstudio.com.br'),
    ('deborataytson@corretorstudio.com', 'deborataytson@corretorstudio.com.br'),
    ('eduarda@corretorstudio.com', 'eduarda@corretorstudio.com.br'),
    ('matheuswillock@corretorstudio.com', 'matheuswillock@corretorstudio.com.br'),
    ('nathielewillock@corretorstudio.com', 'nathielewillock@corretorstudio.com.br')
)
UPDATE public.corretor_studio_profiles AS p
SET
  email = m.new_email,
  "updatedAt" = now()
FROM email_map AS m
WHERE p.email = m.old_email
  AND p.role = 'backoffice';

-- Auth: keep login working after domain change (email provider identity + users.email).
WITH email_map(old_email, new_email) AS (
  VALUES
    ('brunageovana@corretorstudio.com', 'brunageovana@corretorstudio.com.br'),
    ('bruno@corretorstudio.com', 'bruno@corretorstudio.com.br'),
    ('deborataytson@corretorstudio.com', 'deborataytson@corretorstudio.com.br'),
    ('eduarda@corretorstudio.com', 'eduarda@corretorstudio.com.br'),
    ('matheuswillock@corretorstudio.com', 'matheuswillock@corretorstudio.com.br'),
    ('nathielewillock@corretorstudio.com', 'nathielewillock@corretorstudio.com.br')
)
UPDATE auth.users AS u
SET
  email = m.new_email,
  email_change = '',
  email_change_token_current = '',
  email_change_token_new = '',
  email_change_confirm_status = 0,
  updated_at = now()
FROM email_map AS m
WHERE u.email = m.old_email
  AND EXISTS (
    SELECT 1
    FROM public.corretor_studio_profiles AS p
    WHERE p."supabaseId" = u.id
      AND p.role = 'backoffice'
  );

WITH email_map(old_email, new_email) AS (
  VALUES
    ('brunageovana@corretorstudio.com', 'brunageovana@corretorstudio.com.br'),
    ('bruno@corretorstudio.com', 'bruno@corretorstudio.com.br'),
    ('deborataytson@corretorstudio.com', 'deborataytson@corretorstudio.com.br'),
    ('eduarda@corretorstudio.com', 'eduarda@corretorstudio.com.br'),
    ('matheuswillock@corretorstudio.com', 'matheuswillock@corretorstudio.com.br'),
    ('nathielewillock@corretorstudio.com', 'nathielewillock@corretorstudio.com.br')
)
UPDATE auth.identities AS i
SET
  identity_data = jsonb_set(
    COALESCE(i.identity_data, '{}'::jsonb),
    '{email}',
    to_jsonb(m.new_email),
    true
  ),
  updated_at = now()
FROM email_map AS m
WHERE i.provider = 'email'
  AND i.identity_data->>'email' = m.old_email
  AND EXISTS (
    SELECT 1
    FROM public.corretor_studio_profiles AS p
    WHERE p."supabaseId" = i.user_id
      AND p.role = 'backoffice'
  );
