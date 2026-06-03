ALTER TABLE public.corretor_studio_email_contact_lists
ADD COLUMN IF NOT EXISTS "isSystemDefault" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.corretor_studio_email_contact_lists
SET "isSystemDefault" = TRUE
WHERE LOWER(BTRIM(name)) = 'todos contatos';

WITH ranked_defaults AS (
  SELECT
    id,
    "teamId",
    ROW_NUMBER() OVER (PARTITION BY "teamId" ORDER BY "createdAt" ASC, id ASC) AS row_num
  FROM public.corretor_studio_email_contact_lists
  WHERE "isSystemDefault" = TRUE
)
UPDATE public.corretor_studio_email_contact_lists l
SET "isSystemDefault" = FALSE
FROM ranked_defaults r
WHERE l.id = r.id
  AND r.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS corretor_studio_email_contact_lists_team_default_unique_idx
ON public.corretor_studio_email_contact_lists ("teamId")
WHERE "isSystemDefault" = TRUE AND "isArchived" = FALSE;

CREATE OR REPLACE FUNCTION public.prevent_delete_default_email_contact_list()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."isSystemDefault" THEN
    RAISE EXCEPTION 'Default contact list cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_default_email_contact_list
ON public.corretor_studio_email_contact_lists;

CREATE TRIGGER trg_prevent_delete_default_email_contact_list
BEFORE DELETE ON public.corretor_studio_email_contact_lists
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_default_email_contact_list();
