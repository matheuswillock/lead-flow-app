export type BestEffortCalendarFailureInput = {
  existingGoogleEventId?: string | null;
  errorMessage: string;
};

export type BestEffortCalendarFailure = {
  /** A schedule segue vinculada a um evento que ficou com a data anterior. */
  isStaleLinkage: boolean;
  lastError: string;
  payload: { status: "failed"; error: string; staleEventId: string | null };
  warning: string;
};

/**
 * No fluxo Ligação/WhatsApp o evento na agenda do closer é best-effort: a falha
 * não derruba o agendamento, mas precisa ficar registrada. Num reagendamento o
 * vínculo com o evento é mantido de propósito (o próximo upsert bem-sucedido
 * atualiza o mesmo evento em vez de deixar um órfão na agenda), então a schedule
 * tem de sair marcada como dessincronizada.
 */
export function resolveBestEffortCalendarFailure(
  input: BestEffortCalendarFailureInput
): BestEffortCalendarFailure {
  const staleEventId = input.existingGoogleEventId?.trim() || null;
  const isStaleLinkage = staleEventId !== null;

  return {
    isStaleLinkage,
    lastError: isStaleLinkage
      ? `Evento do Google Calendar não foi atualizado e continua com a data anterior (${input.errorMessage}).`
      : `Evento do Google Calendar não foi criado (${input.errorMessage}).`,
    payload: { status: "failed", error: input.errorMessage, staleEventId },
    warning: isStaleLinkage
      ? "Aviso: o evento na agenda Google do closer não foi atualizado e continua com a data anterior. Ajuste o evento manualmente ou reagende novamente."
      : "Aviso: não foi possível criar o evento na agenda Google do closer. O agendamento foi salvo e o lead foi avisado por e-mail.",
  };
}
