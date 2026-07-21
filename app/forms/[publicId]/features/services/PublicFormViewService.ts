import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import type { IPublicFormViewService } from "./IPublicFormViewService"

type Output<T> = { isValid: boolean; result: { snapshot: T }; errorMessages?: string[] }

class PublicFormViewService implements IPublicFormViewService {
  async getSnapshot(publicId: string): Promise<PublicFormSnapshot> {
    const response = await fetch(`/api/v1/public-forms/${publicId}`, { cache: "no-store" })
    const output = (await response.json()) as Output<PublicFormSnapshot>
    if (!response.ok || !output.isValid) {
      throw new Error(output.errorMessages?.[0] || "Formulário indisponível")
    }
    return output.result.snapshot
  }
}

export const publicFormViewService = new PublicFormViewService()
