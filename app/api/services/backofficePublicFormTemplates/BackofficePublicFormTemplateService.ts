import { backofficePublicFormTemplateRepository } from "@/app/api/infra/data/repositories/backofficePublicFormTemplates/BackofficePublicFormTemplateRepository"
import type {
  CreateBackofficePublicFormTemplateInput,
  IBackofficePublicFormTemplateRepository,
  UpdateBackofficePublicFormTemplateInput,
} from "@/app/api/infra/data/repositories/backofficePublicFormTemplates/IBackofficePublicFormTemplateRepository"
import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import { validatePublicFormDraft } from "@/lib/public-forms/validate-public-form-draft"
import type { IBackofficePublicFormTemplateService } from "./IBackofficePublicFormTemplateService"

export class BackofficePublicFormTemplateService implements IBackofficePublicFormTemplateService {
  constructor(private readonly repository: IBackofficePublicFormTemplateRepository) {}

  list(includeInactive: boolean) {
    return this.repository.list(includeInactive)
  }

  getById(id: string) {
    return this.repository.findById(id)
  }

  create(input: CreateBackofficePublicFormTemplateInput) {
    return this.repository.create(input)
  }

  update(id: string, input: UpdateBackofficePublicFormTemplateInput) {
    return this.repository.update(id, input)
  }

  async publish(id: string) {
    const existing = await this.repository.findById(id)
    if (!existing) return null

    const errors = validatePublicFormDraft(existing.draft, { mode: "catalog-template" })
    if (errors.length > 0) {
      throw new Error(errors[0])
    }

    return this.repository.update(id, { isActive: true })
  }

  unpublish(id: string) {
    return this.repository.update(id, { isActive: false })
  }

  validateDraftForPublish(draft: PublicFormDraftInput) {
    return validatePublicFormDraft(draft, { mode: "catalog-template" })
  }
}

export const backofficePublicFormTemplateService = new BackofficePublicFormTemplateService(
  backofficePublicFormTemplateRepository,
)
