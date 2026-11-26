import type { DelinquencyTier, GraceNotice } from "./delinquency-tier";

export type DelinquencyReminderCopy = {
  subject: string;
  headline: string;
  bodyText: string;
};

type AccessTier = Exclude<DelinquencyTier, "full_access">;

/** Tudo o que o e-mail de cobrança pode avisar: os dois degraus de acesso e os dois avisos da carência. */
export type ReminderTier = AccessTier | GraceNotice;

/**
 * Texto de cada degrau, alinhado ao calendário do vencimento: dias 1 a 5 carência, dias 6 a 15
 * somente leitura (só CRM e Carteira) e do dia 16 em diante acesso pausado. O botão do e-mail
 * leva à página de pagamento, a única que o master alcança com a conta limitada.
 */
const COPY_BY_TIER: Record<AccessTier, DelinquencyReminderCopy> = {
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

/** Avisos da carência: o acesso ainda é completo, o e-mail pede a renovação antes de perdê-lo. */
function graceCopy(notice: GraceNotice, graceUntilLabel: string | undefined): DelinquencyReminderCopy {
  const until = graceUntilLabel ? `até ${graceUntilLabel}` : "até o fim da carência";
  if (notice === "grace_started") {
    return {
      subject: "Corretor Studio — O período do seu plano está se encerrando",
      headline: "O período do seu plano está se encerrando",
      bodyText:
        `o ciclo da sua assinatura venceu e sua conta está no período de carência, com acesso completo ${until}. ` +
        "Na página de pagamento você escolhe o prazo da renovação (mensal, trimestral, semestral ou anual) " +
        "e confere os usuários e times adicionais antes de pagar.",
    };
  }
  return {
    subject: "Corretor Studio — Último dia de carência da sua conta",
    headline: "Último dia antes do modo somente leitura",
    bodyText:
      `hoje é o último dia do período de carência (${until}). Depois dele, sua conta passa para o modo ` +
      "somente leitura, com acesso só ao CRM e à Carteira. Renove agora para continuar usando tudo.",
  };
}

export function getDelinquencyReminderCopy(
  tier: ReminderTier,
  options: { graceUntilLabel?: string } = {},
): DelinquencyReminderCopy {
  if (tier === "grace_started" || tier === "grace_last_day") return graceCopy(tier, options.graceUntilLabel);
  return COPY_BY_TIER[tier];
}
