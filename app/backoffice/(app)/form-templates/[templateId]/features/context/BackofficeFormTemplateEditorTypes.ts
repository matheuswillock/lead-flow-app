import type { PublicFormWizardHost } from "@/app/[supabaseId]/forms/features/container/PublicFormWizard"

export type BackofficeFormTemplateEditorContextValue = {
  templateId?: string
  host: PublicFormWizardHost
}
