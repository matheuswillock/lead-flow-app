import type {
  BackofficePublicFormTemplateDetail,
  BackofficePublicFormTemplateListItem,
  CreateBackofficePublicFormTemplateInput,
  UpdateBackofficePublicFormTemplateInput,
} from "@/app/api/infra/data/repositories/backofficePublicFormTemplates/IBackofficePublicFormTemplateRepository"

export interface IBackofficePublicFormTemplateService {
  list(includeInactive: boolean): Promise<BackofficePublicFormTemplateListItem[]>
  getById(id: string): Promise<BackofficePublicFormTemplateDetail | null>
  create(input: CreateBackofficePublicFormTemplateInput): Promise<BackofficePublicFormTemplateDetail>
  update(
    id: string,
    input: UpdateBackofficePublicFormTemplateInput,
  ): Promise<BackofficePublicFormTemplateDetail | null>
  publish(id: string): Promise<BackofficePublicFormTemplateDetail | null>
  unpublish(id: string): Promise<BackofficePublicFormTemplateDetail | null>
}
