import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export interface PublicFormViewState {
  publicId: string
  publicationId: string | null
  snapshot: PublicFormSnapshot | null
  error: string | null
  isLoading: boolean
}
