import type { PublicFormLegalNotice } from "@/lib/legal/form-privacy-policy"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export interface PublicFormViewState {
  publicId: string
  publicationId: string | null
  snapshot: PublicFormSnapshot | null
  /** Controlador (acesso master) exibido na política de privacidade do formulário. */
  legalNotice: PublicFormLegalNotice | null
  error: string | null
  isLoading: boolean
}
