import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import type { IPublicFormViewService } from "./IPublicFormViewService"
import { API_CLIENT_BASE } from "@/lib/route-map";

type Output<T> = {
  isValid: boolean
  result: { snapshot: T; publicationId: string }
  errorMessages?: string[]
}

class PublicFormViewService implements IPublicFormViewService {
  async getSnapshot(publicId: string): Promise<{ snapshot: PublicFormSnapshot; publicationId: string }> {
    const response = await fetch(`${API_CLIENT_BASE}/public-forms/${publicId}`, { cache: "no-store" })
    const output = (await response.json()) as Output<PublicFormSnapshot>
    if (!response.ok || !output.isValid) {
      throw new Error(output.errorMessages?.[0] || "Formulário indisponível")
    }
    return output.result
  }
}

export const publicFormViewService = new PublicFormViewService()
