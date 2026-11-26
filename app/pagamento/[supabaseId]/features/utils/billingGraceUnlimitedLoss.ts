import type { BillingGraceCycleQuote } from "../context/BillingGracePaymentTypes";

/**
 * O que a tela diz a quem tinha usuários ilimitados (plano anual) e escolheu um prazo que não os
 * inclui. `quote` já vem com os usuários que o master manteve (`applyKeptUsers`).
 */
export type UnlimitedLossNotice =
  /** Há usuários adicionais a cobrar neste prazo. */
  | { kind: "charged"; userCount: number; monthlyPrice: number; periodTotal: number; months: number }
  /** A conta não tem usuários adicionais: nada muda no valor. */
  | { kind: "no_extra_users" }
  /** Todos foram desmarcados: ninguém é cobrado e todos perdem o acesso. */
  | { kind: "all_removed" };

export function resolveUnlimitedLossNotice(
  quote: Pick<BillingGraceCycleQuote, "losesUnlimitedUsers" | "accountUsers" | "billedUsers" | "extraUserPrice" | "extraUsersTotal" | "months">,
): UnlimitedLossNotice | null {
  if (!quote.losesUnlimitedUsers) return null;
  if (quote.accountUsers.length === 0) return { kind: "no_extra_users" };
  if (quote.billedUsers.length === 0) return { kind: "all_removed" };
  // Usuário com preço zerado no backoffice: sair do anual não custa nada, então não há o que avisar.
  if (quote.extraUsersTotal <= 0) return null;
  return {
    kind: "charged",
    userCount: quote.billedUsers.length,
    monthlyPrice: quote.extraUserPrice,
    periodTotal: quote.extraUsersTotal,
    months: quote.months,
  };
}
