import type { PublicFormLegalNotice } from "@/lib/legal/form-privacy-policy"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export type PublicFormViewSnapshotResult = {
  snapshot: PublicFormSnapshot
  publicationId: string
  legalNotice?: PublicFormLegalNotice | null
}

export interface IPublicFormViewService {
  getSnapshot(publicId: string): Promise<PublicFormViewSnapshotResult>
}
