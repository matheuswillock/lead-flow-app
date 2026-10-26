import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export interface IPublicFormViewService {
  getSnapshot(publicId: string): Promise<{ snapshot: PublicFormSnapshot; publicationId: string }>
}
