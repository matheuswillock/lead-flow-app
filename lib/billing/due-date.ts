/**
 * O vencimento já passou? Compara só a data (o vencimento vem como meia-noite UTC do dia) com o
 * dia de hoje em São Paulo: quem vence hoje ainda está em dia. Fonte única para a decisão de
 * acesso e para a transição de status por data.
 */
export function isDueDateBeforeTodayInSaoPaulo(dueDate: Date, now: Date): boolean {
  const today = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  return dueDate.toISOString().slice(0, 10) < today
}
