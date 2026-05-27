ALTER TABLE public.backoffice_leads
  ADD COLUMN IF NOT EXISTS "como_voce_organiza_seus_leads_e_carteira" text,
  ADD COLUMN IF NOT EXISTS "quantos_usuarios_em_media_voce_precisa" text,
  ADD COLUMN IF NOT EXISTS "qual_perfil_se_enquadra_em_seu_momento" text;
