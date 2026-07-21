"use client"

import { usePublicFormEditContext } from "../context/PublicFormEditContext"
import { PublicFormWizard } from "../../../features/container/PublicFormWizard"

export function PublicFormEditContainer() {
  const { formId } = usePublicFormEditContext()
  return <PublicFormWizard formId={formId} />
}
