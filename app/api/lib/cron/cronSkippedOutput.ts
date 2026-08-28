import { Output } from "@/lib/output"

/**
 * Resultado de um cron que rodou e decidiu, de propósito, não trabalhar.
 *
 * Sair antes do `withCronAudit` (o padrão antigo dos crons do WhatsApp) torna
 * a execução invisível: não dá para distinguir "gate desligado" de "cron
 * quebrado" nem de "cron que nunca disparou". Registrar o skip como execução
 * `success` com `{skipped: motivo}` na metadata mantém presença na tabela como
 * invariante de todos os crons.
 */
export const CRON_SKIP_REASON_FEATURE_DISABLED = "feature_disabled"

export function buildSkippedCronOutput(reason: string): Output {
  return new Output(true, [`Execução ignorada: ${reason}`], [], { skipped: reason })
}
