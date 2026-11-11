import type { DelinquencyTier } from "./delinquency-tier";

export type DelinquencyReminderCopy = {
  subject: string;
  headline: string;
  bodyText: string;
};

type NotifiableDelinquencyTier = Exclude<DelinquencyTier, "full_access">;

/**
 * Texto de cada degrau, alinhado ao calendário do vencimento: dias 1 a 5 carência, dias 6 a 15
 * somente leitura (só CRM e Carteira) e do dia 16 em diante acesso pausado. O botão do e-mail
 * leva à página de pagamento, a única que o master alcança com a conta limitada.
 */
const COPY_BY_TIER: Record<NotifiableDelinquencyTier, DelinquencyReminderCopy> = {
  crm_only: {
    subject: "Corretor Studio — Sua conta está em modo somente leitura",
    headline: "Sua conta está em modo somente leitura",
    bodyText:
      "sua assinatura está em atraso. Por enquanto você só pode visualizar o CRM e a Carteira. " +
      "Regularize o pagamento para voltar a usar tudo. Sem a regularização, o acesso é pausado por completo.",
  },
  cut_off: {
    subject: "Corretor Studio — Acesso pausado por falta de pagamento",
    headline: "Seu acesso está pausado",
    bodyText:
      "sua assinatura está em atraso há mais de 15 dias e o acesso à plataforma está pausado. " +
      "Regularize o pagamento para reativar a conta.",
  },
};

export function getDelinquencyReminderCopy(tier: NotifiableDelinquencyTier): DelinquencyReminderCopy {
  return COPY_BY_TIER[tier];
}
