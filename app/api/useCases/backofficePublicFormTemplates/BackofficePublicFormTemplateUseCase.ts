import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import { createEmptyPublicFormDraft } from "@/lib/public-forms/empty-draft"
import { BackofficeHealthPlanRepository } from "@/app/api/infra/data/repositories/backoffice/healthPlan/BackofficeHealthPlanRepository"
import type { IBackofficePublicFormTemplateService } from "@/app/api/services/backofficePublicFormTemplates/IBackofficePublicFormTemplateService"
import { backofficePublicFormTemplateService } from "@/app/api/services/backofficePublicFormTemplates/BackofficePublicFormTemplateService"

const SLUG_PATTERN = /^[a-z0-9_]+$/

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

function syncDraftMetadata(
  draft: PublicFormDraftInput,
  meta: { name?: string; description?: string | null; formKind?: string },
): PublicFormDraftInput {
  return {
    ...draft,
    ...(meta.name !== undefined ? { name: meta.name } : {}),
    ...(meta.description !== undefined ? { description: meta.description } : {}),
    ...(meta.formKind !== undefined ? { formKind: meta.formKind as PublicFormDraftInput["formKind"] } : {}),
    assignedSdrId: null,
    eligibleCloserIds: [],
    schedulingEnabled: false,
  }
}

export class BackofficePublicFormTemplateUseCase {
  constructor(private readonly service: IBackofficePublicFormTemplateService) {}

  async list(includeInactive: boolean): Promise<Output> {
    try {
      const items = await this.service.list(includeInactive)
      return new Output(true, [], [], items)
    } catch (error) {
      console.error("[BackofficePublicFormTemplateUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar templates de formulário"], null)
    }
  }

  async getById(id: string): Promise<Output> {
    try {
      const item = await this.service.getById(id)
      if (!item) return new Output(false, [], ["Template não encontrado"], null)
      return new Output(true, [], [], item)
    } catch (error) {
      console.error("[BackofficePublicFormTemplateUseCase][getById]", error)
      return new Output(false, [], ["Erro ao carregar template"], null)
    }
  }

  async create(input: {
    slug: string
    name: string
    description?: string | null
    formKind?: string
    sortOrder?: number
    draft?: PublicFormDraftInput
  }): Promise<Output> {
    try {
      const slug = normalizeSlug(input.slug)
      if (!slug || !SLUG_PATTERN.test(slug)) {
        return new Output(false, [], ["Slug inválido. Use letras minúsculas, números e _"], null)
      }

      const name = input.name?.trim()
      if (!name) {
        return new Output(false, [], ["Nome do template é obrigatório"], null)
      }

      const baseDraft = input.draft ?? createEmptyPublicFormDraft()
      const draft = syncDraftMetadata(baseDraft, {
        name,
        description: input.description ?? null,
        formKind: input.formKind ?? baseDraft.formKind ?? "standard",
      })

      const item = await this.service.create({
        slug,
        name,
        description: input.description ?? null,
        formKind: input.formKind ?? "standard",
        sortOrder: input.sortOrder ?? 0,
        draft,
      })
      return new Output(true, ["Template criado com sucesso"], [], item)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return new Output(false, [], ["Já existe um template com este slug"], null)
      }
      console.error("[BackofficePublicFormTemplateUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar template"], null)
    }
  }

  async update(
    id: string,
    input: {
      name?: string
      description?: string | null
      formKind?: string
      sortOrder?: number
      draft?: PublicFormDraftInput
    },
  ): Promise<Output> {
    try {
      const existing = await this.service.getById(id)
      if (!existing) return new Output(false, [], ["Template não encontrado"], null)

      const name = input.name?.trim() ?? existing.name
      if (!name.trim()) {
        return new Output(false, [], ["Nome do template é obrigatório"], null)
      }

      const draft = input.draft
        ? syncDraftMetadata(input.draft, {
            name,
            description: input.description ?? existing.description,
            formKind: input.formKind ?? existing.formKind,
          })
        : undefined

      const item = await this.service.update(id, {
        name,
        description: input.description,
        formKind: input.formKind,
        sortOrder: input.sortOrder,
        draft,
      })
      if (!item) return new Output(false, [], ["Template não encontrado"], null)
      return new Output(true, ["Template atualizado com sucesso"], [], item)
    } catch (error) {
      console.error("[BackofficePublicFormTemplateUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar template"], null)
    }
  }

  async publish(id: string): Promise<Output> {
    try {
      const item = await this.service.publish(id)
      if (!item) return new Output(false, [], ["Template não encontrado"], null)
      return new Output(true, ["Template publicado com sucesso"], [], item)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao publicar template"
      return new Output(false, [], [message], null)
    }
  }

  async unpublish(id: string): Promise<Output> {
    try {
      const item = await this.service.unpublish(id)
      if (!item) return new Output(false, [], ["Template não encontrado"], null)
      return new Output(true, ["Template despublicado com sucesso"], [], item)
    } catch (error) {
      console.error("[BackofficePublicFormTemplateUseCase][unpublish]", error)
      return new Output(false, [], ["Erro ao despublicar template"], null)
    }
  }

  async wizardContext(): Promise<Output> {
    try {
      const plans = await new BackofficeHealthPlanRepository().list(false)
      const context = {
        healthPlans: plans.map((plan: { id: string; name: string }) => ({
          id: plan.id,
          name: plan.name,
        })),
        customFields: [] as [],
        members: [] as [],
        settings: null,
      }
      return new Output(true, [], [], context)
    } catch (error) {
      console.error("[BackofficePublicFormTemplateUseCase][wizardContext]", error)
      return new Output(false, [], ["Erro ao carregar contexto do wizard"], null)
    }
  }
}

export const backofficePublicFormTemplateUseCase = new BackofficePublicFormTemplateUseCase(
  backofficePublicFormTemplateService,
)
