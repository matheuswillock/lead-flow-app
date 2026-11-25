-- AlterTable
-- Telefone do operador pendente: levado ao perfil quando o pagamento confirma.
-- Nulo em pendências antigas; idempotente porque o `bun run dev` aplica por db push antes.
ALTER TABLE "corretor_studio_pending_operators" ADD COLUMN IF NOT EXISTS "phone" TEXT;
