-- Versão do link de convite por perfil. Incrementada quando o vínculo do membro é
-- removido de um time: tokens assinados com versão antiga deixam de ser aceitos na troca.
ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN IF NOT EXISTS "inviteLinkVersion" integer NOT NULL DEFAULT 0;
