import type { PublicFormSubmissionContext } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"

export type PublicFormLeadAssignment = {
  assignedTo: string | undefined
  closerId: undefined
}

/**
 * Campanha de e-mail e formulário público só atribuem SDR via configuração do form.
 * Closer nunca é definido na criação (agendamento no form é outro fluxo).
 */
export function resolvePublicFormLeadAssignment(
  form: Pick<PublicFormSubmissionContext, "assignedSdrId">,
): PublicFormLeadAssignment {
  return {
    assignedTo: form.assignedSdrId ?? undefined,
    closerId: undefined,
  }
}
