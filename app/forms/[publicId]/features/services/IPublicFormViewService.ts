import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export interface IPublicFormViewService {
  getSnapshot(publicId: string): Promise<PublicFormSnapshot>
}
