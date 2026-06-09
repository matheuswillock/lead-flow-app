import { Output } from "@/lib/output"
import type {
  BackofficeEmailTemplatesService,
  EmailTemplateListItem,
} from "@/app/api/services/backofficeEmailTemplates/BackofficeEmailTemplatesService"
import type { CreateTemplateOptions, Template, UpdateTemplateOptions } from "resend"

export type CreateTemplateInput = {
  name: string
  html: string
  alias?: string
  from?: string
  subject?: string
  replyTo?: string | string[]
  text?: string
  variables?: Array<{
    key: string
    type: "string" | "number"
    fallbackValue?: string | number | null
  }>
}

export type UpdateTemplateInput = Partial<Omit<CreateTemplateInput, "name">> & { name?: string }

import { backofficeEmailTemplatesService } from "@/app/api/services/backofficeEmailTemplates/BackofficeEmailTemplatesService"

export class BackofficeEmailTemplatesUseCase {
  constructor(private readonly service: BackofficeEmailTemplatesService) {}

  async list(): Promise<Output> {
    try {
      const items: EmailTemplateListItem[] = await this.service.list()
      return new Output(true, [], [], items)
    } catch (error) {
      console.error("[BackofficeEmailTemplatesUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar templates de e-mail"], null)
    }
  }

  async create(input: CreateTemplateInput): Promise<Output> {
    try {
      const name = input.name?.trim()
      if (!name) {
        return new Output(false, [], ["Nome do template é obrigatório"], null)
      }
      if (!input.html?.trim()) {
        return new Output(false, [], ["HTML do template é obrigatório"], null)
      }
      const payload: CreateTemplateOptions = {
        name,
        html: input.html,
        ...(input.alias ? { alias: input.alias } : {}),
        ...(input.from ? { from: input.from } : {}),
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.variables?.length
          ? { variables: input.variables as CreateTemplateOptions["variables"] }
          : {}),
      }
      const result = await this.service.create(payload)
      return new Output(true, ["Template criado com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeEmailTemplatesUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar template de e-mail"], null)
    }
  }

  async get(id: string): Promise<Output> {
    try {
      const template: Template = await this.service.get(id)
      return new Output(true, [], [], template)
    } catch (error) {
      console.error("[BackofficeEmailTemplatesUseCase][get]", error)
      return new Output(false, [], ["Erro ao buscar template de e-mail"], null)
    }
  }

  async update(id: string, input: UpdateTemplateInput): Promise<Output> {
    try {
      if (!id) {
        return new Output(false, [], ["ID do template é obrigatório"], null)
      }
      const payload: Parameters<typeof this.service.update>[1] = {}
      if (input.name !== undefined) payload.name = input.name.trim()
      if (input.html !== undefined) payload.html = input.html
      if (input.alias !== undefined) payload.alias = input.alias
      if (input.from !== undefined) payload.from = input.from
      if (input.subject !== undefined) payload.subject = input.subject
      if (input.replyTo !== undefined) payload.replyTo = input.replyTo
      if (input.text !== undefined) payload.text = input.text
      if (input.variables !== undefined) {
        payload.variables = input.variables as UpdateTemplateOptions["variables"]
      }
      const result = await this.service.update(id, payload)
      return new Output(true, ["Template atualizado com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeEmailTemplatesUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar template de e-mail"], null)
    }
  }

  async remove(id: string): Promise<Output> {
    try {
      await this.service.remove(id)
      return new Output(true, ["Template excluído com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeEmailTemplatesUseCase][remove]", error)
      return new Output(false, [], ["Erro ao excluir template de e-mail"], null)
    }
  }

  async publish(id: string): Promise<Output> {
    try {
      const result = await this.service.publish(id)
      return new Output(true, ["Template publicado com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeEmailTemplatesUseCase][publish]", error)
      return new Output(false, [], ["Erro ao publicar template de e-mail"], null)
    }
  }

  async duplicate(id: string): Promise<Output> {
    try {
      const result = await this.service.duplicate(id)
      return new Output(true, ["Template duplicado com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeEmailTemplatesUseCase][duplicate]", error)
      return new Output(false, [], ["Erro ao duplicar template de e-mail"], null)
    }
  }
}

export const backofficeEmailTemplatesUseCase = new BackofficeEmailTemplatesUseCase(backofficeEmailTemplatesService)
