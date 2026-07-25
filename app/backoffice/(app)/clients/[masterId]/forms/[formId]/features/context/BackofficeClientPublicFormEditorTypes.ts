import type { PublicFormWizardHost } from "@/app/[supabaseId]/forms/features/container/PublicFormWizard"

export type BackofficeClientPublicFormEditorContextValue = {
  masterId: string
  teamId: string | null
  formId?: string
  host: PublicFormWizardHost | null
  error: string | null
}
