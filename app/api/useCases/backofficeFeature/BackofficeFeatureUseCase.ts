import { Output } from "@/lib/output"
import type {
  BackofficeAccessPrincipal,
  BackofficeFeatureAccessLevel,
  BackofficeFeatureAccessMode,
} from "@prisma/client"
import { BackofficeFeatureRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeFeature/BackofficeFeatureRepository"
import type { IBackofficeFeatureRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeFeature/IBackofficeFeatureRepository"
import { toFeatureSlug } from "@/lib/features/slug"

export interface CreateBackofficeFeatureInput {
  name: string
  description?: string | null
  parentId?: string | null
  productSlug?: string | null
  accessMode?: BackofficeFeatureAccessMode
  defaultAccessLevel?: BackofficeFeatureAccessLevel
  betaEnabled?: boolean
  inheritParentSettings?: boolean
  isActive?: boolean
  sortOrder?: number
  accessRules?: Array<{ principal: string; accessLevel: string }>
}

export interface UpdateBackofficeFeatureInput {
  name?: string
  description?: string | null
  parentId?: string | null
  productSlug?: string | null
  accessMode?: BackofficeFeatureAccessMode
  defaultAccessLevel?: BackofficeFeatureAccessLevel
  betaEnabled?: boolean
  inheritParentSettings?: boolean
  isActive?: boolean
  sortOrder?: number
  accessRules?: Array<{ principal: string; accessLevel: string }>
}

export class BackofficeFeatureUseCase {
  constructor(private readonly featureRepo: IBackofficeFeatureRepository) {}

  async list(): Promise<Output> {
    try {
      const features = await this.featureRepo.findAll()
      return new Output(true, [], [], features)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar funcionalidades"], null)
    }
  }

  async create(input: CreateBackofficeFeatureInput): Promise<Output> {
    try {
      if (!input.name?.trim()) {
        return new Output(false, [], ["Nome é obrigatório"], null)
      }

      if (input.parentId) {
        const parent = await this.featureRepo.findById(input.parentId)
        if (!parent) {
          return new Output(false, [], ["Funcionalidade pai não encontrada"], null)
        }
      }

      if (input.inheritParentSettings && !input.parentId) {
        return new Output(
          false,
          [],
          ["Herança só pode ser habilitada para sub-funcionalidades com pai definido"],
          null
        )
      }

      if (input.productSlug) {
        const productExists = await this.featureRepo.productSlugExists(input.productSlug)
        if (!productExists) {
          return new Output(false, [], ["Produto associado não encontrado"], null)
        }
      }

      const slug = await this.generateUniqueSlug(input.name)

      const created = await this.featureRepo.create({
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        productSlug: input.productSlug ?? null,
        accessMode: input.accessMode ?? "PUBLIC",
        defaultAccessLevel: input.defaultAccessLevel ?? "FULL",
        betaEnabled: input.betaEnabled ?? false,
        inheritParentSettings: input.inheritParentSettings ?? false,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      })

      if (input.accessRules && input.accessRules.length > 0) {
        const normalizedRules = this.normalizeAccessRules(input.accessRules)
        await this.featureRepo.replaceAccessRules(created.id, normalizedRules)
      }

      const detailed = (await this.featureRepo.findAll()).find((feature) => feature.id === created.id) ?? created
      return new Output(true, ["Funcionalidade criada com sucesso"], [], detailed)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar funcionalidade"], null)
    }
  }

  async update(id: string, input: UpdateBackofficeFeatureInput): Promise<Output> {
    try {
      const existing = await this.featureRepo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Funcionalidade não encontrada"], null)
      }

      if (input.parentId) {
        if (input.parentId === id) {
          return new Output(false, [], ["A funcionalidade não pode apontar para si mesma"], null)
        }
        const parent = await this.featureRepo.findById(input.parentId)
        if (!parent) {
          return new Output(false, [], ["Funcionalidade pai não encontrada"], null)
        }
      }

      if (Object.prototype.hasOwnProperty.call(input, "productSlug") && input.productSlug) {
        const productExists = await this.featureRepo.productSlugExists(input.productSlug)
        if (!productExists) {
          return new Output(false, [], ["Produto associado não encontrado"], null)
        }
      }

      const effectiveParentId = Object.prototype.hasOwnProperty.call(input, "parentId")
        ? (input.parentId ?? null)
        : (existing.parentId ?? null)
      const effectiveInheritParentSettings =
        input.inheritParentSettings !== undefined
          ? input.inheritParentSettings
          : existing.inheritParentSettings

      if (effectiveInheritParentSettings && !effectiveParentId) {
        return new Output(
          false,
          [],
          ["Herança só pode ser habilitada para sub-funcionalidades com pai definido"],
          null
        )
      }

      const updated = await this.featureRepo.update(id, input)

      if (input.accessRules) {
        const normalizedRules = this.normalizeAccessRules(input.accessRules)
        await this.featureRepo.replaceAccessRules(id, normalizedRules)
      }

      const detailed = (await this.featureRepo.findAll()).find((feature) => feature.id === updated.id) ?? updated
      return new Output(true, ["Funcionalidade atualizada com sucesso"], [], detailed)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar funcionalidade"], null)
    }
  }

  async delete(id: string): Promise<Output> {
    try {
      const existing = await this.featureRepo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Funcionalidade não encontrada"], null)
      }

      await this.featureRepo.delete(id)
      return new Output(true, ["Funcionalidade excluída com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][delete]", error)
      return new Output(false, [], ["Erro ao excluir funcionalidade"], null)
    }
  }

  async listUsers(query: string, page: number, pageSize: number): Promise<Output> {
    try {
      const normalizedQuery = query.trim()
      const safePage = Math.max(1, page)
      const safePageSize = Math.max(5, pageSize)
      const { items, totalItems } = await this.featureRepo.searchUsers(normalizedQuery, safePage, safePageSize)
      const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
      return new Output(true, [], [], {
        items,
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          totalItems,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPreviousPage: safePage > 1,
        },
      })
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][listUsers]", error)
      return new Output(false, [], ["Erro ao buscar usuários"], null)
    }
  }

  async listSlugs(): Promise<Output> {
    try {
      const slugs = await this.featureRepo.listAvailableSlugs()
      return new Output(true, [], [], slugs)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][listSlugs]", error)
      return new Output(false, [], ["Erro ao listar slugs de funcionalidades"], null)
    }
  }

  async addBetaUser(featureId: string, profileId: string): Promise<Output> {
    try {
      const feature = await this.featureRepo.findById(featureId)
      if (!feature) {
        return new Output(false, [], ["Funcionalidade não encontrada"], null)
      }

      const profileExists = await this.featureRepo.profileExists(profileId)
      if (!profileExists) {
        return new Output(false, [], ["Perfil não encontrado"], null)
      }

      const grant = await this.featureRepo.upsertBetaGrant({ featureId, profileId })
      return new Output(true, ["Usuário beta vinculado com sucesso"], [], grant)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][addBetaUser]", error)
      return new Output(false, [], ["Erro ao vincular usuário beta"], null)
    }
  }

  async removeBetaUser(featureId: string, profileId: string): Promise<Output> {
    try {
      await this.featureRepo.disableBetaGrant(featureId, profileId)
      return new Output(true, ["Usuário beta removido com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][removeBetaUser]", error)
      return new Output(false, [], ["Erro ao remover usuário beta"], null)
    }
  }

  async listBetaUsers(featureId: string): Promise<Output> {
    try {
      const feature = await this.featureRepo.findById(featureId)
      if (!feature) {
        return new Output(false, [], ["Funcionalidade não encontrada"], null)
      }
      const grants = await this.featureRepo.listBetaGrants(featureId)
      return new Output(true, [], [], grants)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][listBetaUsers]", error)
      return new Output(false, [], ["Erro ao listar usuários beta"], null)
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = toFeatureSlug(name) || "feature"
    let candidate = base
    let suffix = 2

    while (true) {
      const existing = await this.featureRepo.findBySlug(candidate)
      if (!existing) {
        return candidate
      }
      candidate = `${base}-${suffix}`
      suffix += 1
    }
  }

  private normalizeAccessRules(
    rules: Array<{ principal: string; accessLevel: string }>
  ): Array<{ principal: BackofficeAccessPrincipal; accessLevel: BackofficeFeatureAccessLevel }> {
    const validPrincipals: BackofficeAccessPrincipal[] = [
      "MASTER",
      "MANAGER",
      "BACKOFFICE",
      "OPERATOR",
      "SDR",
      "CLOSER",
      "CAN_MANAGE_TEAMS",
      "CAN_CREATE_USERS",
    ]
    const validLevels: BackofficeFeatureAccessLevel[] = ["NONE", "READ", "FULL"]

    const byPrincipal = new Map<BackofficeAccessPrincipal, BackofficeFeatureAccessLevel>()
    for (const rule of rules) {
      if (
        validPrincipals.includes(rule.principal as BackofficeAccessPrincipal) &&
        validLevels.includes(rule.accessLevel as BackofficeFeatureAccessLevel)
      ) {
        byPrincipal.set(
          rule.principal as BackofficeAccessPrincipal,
          rule.accessLevel as BackofficeFeatureAccessLevel
        )
      }
    }

    return Array.from(byPrincipal.entries()).map(([principal, accessLevel]) => ({
      principal,
      accessLevel,
    }))
  }
}

export const backofficeFeatureUseCase = new BackofficeFeatureUseCase(
  new BackofficeFeatureRepository()
)
