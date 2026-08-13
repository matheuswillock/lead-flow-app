-- Origem CRM para leads criados via formulário atribuído a campanha de e-mail.
-- Valor físico do enum Prisma LeadOriginChannel (sem @@map).
ALTER TYPE "public"."LeadOriginChannel" ADD VALUE IF NOT EXISTS 'email_campaign';
