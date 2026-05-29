import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import type { IBackofficeHealthPlanUseCase } from "./IBackofficeHealthPlanUseCase"
import { backofficeHealthPlanService } from "@/app/api/services/backofficeHealthPlan/BackofficeHealthPlanService"
import type { IBackofficeHealthPlanService } from "@/app/api/services/backofficeHealthPlan/IBackofficeHealthPlanService"

function parseUrlOrNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined
    return trimmed
  } catch {
    return undefined
  }
}

export class BackofficeHealthPlanUseCase implements IBackofficeHealthPlanUseCase {
  constructor(private readonly service: IBackofficeHealthPlanService) {}

  async list(includeInactive: boolean): Promise<Output> {
    try {
      const items = await this.service.list(includeInactive)
      return new Output(true, [], [], items)
    } catch (error) {
      console.error("[BackofficeHealthPlanUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar operadoras"], null)
    }
  }

  async create(input: { name: string; iconUrl?: string | null; isDefault?: boolean; createdBy?: string | null }): Promise<Output> {
    try {
      const name = input.name?.trim().replace(/\s+/g, " ")
      if (!name) {
        return new Output(false, [], ["Nome da operadora é obrigatório"], null)
      }

      const iconUrl = parseUrlOrNull(input.iconUrl)
      if (input.iconUrl !== undefined && iconUrl === undefined) {
        return new Output(false, [], ["URL do ícone inválida"], null)
      }

      const item = await this.service.create({
        name,
        iconUrl,
        isDefault: input.isDefault ?? false,
        createdBy: input.createdBy ?? null,
      })
      return new Output(true, ["Operadora criada com sucesso"], [], item)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return new Output(false, [], ["Operadora já cadastrada"], null)
      }
      console.error("[BackofficeHealthPlanUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar operadora"], null)
    }
  }

  async update(id: string, input: { name?: string; iconUrl?: string | null; isDefault?: boolean; isActive?: boolean }): Promise<Output> {
    try {
      const payload: { name?: string; iconUrl?: string | null; isDefault?: boolean; isActive?: boolean } = {}

      if (input.name !== undefined) {
        const safeName = input.name.trim().replace(/\s+/g, " ")
        if (!safeName) {
          return new Output(false, [], ["Nome da operadora é obrigatório"], null)
        }
        payload.name = safeName
      }

      if (input.iconUrl !== undefined) {
        const parsed = parseUrlOrNull(input.iconUrl)
        if (parsed === undefined) {
          return new Output(false, [], ["URL do ícone inválida"], null)
        }
        payload.iconUrl = parsed
      }

      if (input.isDefault !== undefined) payload.isDefault = input.isDefault
      if (input.isActive !== undefined) payload.isActive = input.isActive

      const item = await this.service.update(id, payload)
      if (!item) {
        return new Output(false, [], ["Plano de saúde não encontrado"], null)
      }
      return new Output(true, ["Operadora atualizada com sucesso"], [], item)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return new Output(false, [], ["Operadora já cadastrada"], null)
      }
      console.error("[BackofficeHealthPlanUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar operadora"], null)
    }
  }

  async deactivate(id: string): Promise<Output> {
    try {
      const item = await this.service.deactivate(id)
      if (!item) {
        return new Output(false, [], ["Plano de saúde não encontrado"], null)
      }
      return new Output(true, ["Operadora inativada com sucesso"], [], item)
    } catch (error) {
      console.error("[BackofficeHealthPlanUseCase][deactivate]", error)
      return new Output(false, [], ["Erro ao inativar operadora"], null)
    }
  }
}

export const backofficeHealthPlanUseCase = new BackofficeHealthPlanUseCase(backofficeHealthPlanService)
