import { Output } from "@/lib/output"
import { cacheLife, cacheTag } from "next/cache"
import { cacheTags } from "@/lib/cache/cacheTags"
import type {
  BackofficeAccessPrincipal,
  BackofficeFeatureAccessLevel,
  BackofficeFeatureAccessMode,
} from "@prisma/client"
import { BackofficeFeatureRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeFeature/BackofficeFeatureRepository"
import type { IBackofficeFeatureRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeFeature/IBackofficeFeatureRepository"
import type { BackofficeBetaTeamScope } from "@prisma/client"
import { toFeatureSlug } from "@/lib/features/slug"

export interface AddBetaUserInput {
  profileId: string
  betaTeamScope: BackofficeBetaTeamScope
  teamIds?: string[]
}

export interface CreateBackofficeFeatureInput {
  name: string
  description?: string | null
  parentId?: string | null
  productSlug?: string | null
  accessMode?: BackofficeFeatureAccessMode
  defaultAccessLevel?: BackofficeFeatureAccessLevel
  betaEnabled?: boolean
  inheritParentSettings?: boolean
  billedSeparately?: boolean
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
  billedSeparately?: boolean
  isActive?: boolean
  sortOrder?: number
  accessRules?: Array<{ principal: string; accessLevel: string }>
}

const backofficeFeatureRepository = new BackofficeFeatureRepository()

export async function listCachedBackofficeFeatures() {
  "use cache"
  cacheTag(cacheTags.backofficeFeatures())
  cacheLife({ revalidate: 300, expire: 900 })

  return backofficeFeatureRepository.findAll()
}

export async function listCachedBackofficeFeatureSlugs() {
  "use cache"
  cacheTag(cacheTags.backofficeFeatures())
  cacheLife({ revalidate: 300, expire: 900 })

  return backofficeFeatureRepository.listAvailableSlugs()
}

export class BackofficeFeatureUseCase {
  constructor(private readonly featureRepo: IBackofficeFeatureRepository) {}

  async list(): Promise<Output> {
    try {
      const features = await listCachedBackofficeFeatures()
      const mapped = features.map((feature) => ({
        ...feature,
        grants: feature.grants.map((grant) => this.mapBetaGrant(grant)),
      }))
      return new Output(true, [], [], mapped)
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

      const createInheritParentSettings = input.inheritParentSettings ?? false
      const createBilledSeparately =
        createInheritParentSettings ? false : (input.billedSeparately ?? false)

      if (createInheritParentSettings && input.betaEnabled) {
        return new Output(
          false,
          [],
          ["Funcionalidades que herdam do pai não podem ter beta próprio"],
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
        betaEnabled: createInheritParentSettings ? false : (input.betaEnabled ?? false),
        inheritParentSettings: createInheritParentSettings,
        billedSeparately: input.parentId ? createBilledSeparately : false,
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

      const effectiveBetaEnabled =
        input.betaEnabled !== undefined ? input.betaEnabled : existing.betaEnabled

      if (effectiveInheritParentSettings && effectiveBetaEnabled) {
        return new Output(
          false,
          [],
          ["Funcionalidades que herdam do pai não podem ter beta próprio"],
          null
        )
      }

      const effectiveBilledSeparately = effectiveInheritParentSettings
        ? false
        : input.billedSeparately !== undefined
          ? input.billedSeparately
          : existing.billedSeparately

      const normalizedInput: UpdateBackofficeFeatureInput = {
        ...input,
        ...(effectiveInheritParentSettings ? { betaEnabled: false, billedSeparately: false } : {}),
        ...(!effectiveParentId ? { billedSeparately: false } : { billedSeparately: effectiveBilledSeparately }),
      }

      const updated = await this.featureRepo.update(id, normalizedInput)

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

  async listUsers(
    query: string,
    page: number,
    pageSize: number,
    options?: { mastersOnly?: boolean }
  ): Promise<Output> {
    try {
      const normalizedQuery = query.trim()
      const safePage = Math.max(1, page)
      const safePageSize = Math.max(5, pageSize)
      const { items, totalItems } = await this.featureRepo.searchUsers(
        normalizedQuery,
        safePage,
        safePageSize,
        options
      )
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
      const slugs = await listCachedBackofficeFeatureSlugs()
      return new Output(true, [], [], slugs)
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][listSlugs]", error)
      return new Output(false, [], ["Erro ao listar slugs de funcionalidades"], null)
    }
  }

  async addBetaUser(featureId: string, input: AddBetaUserInput): Promise<Output> {
    try {
      const feature = await this.featureRepo.findById(featureId)
      if (!feature) {
        return new Output(false, [], ["Funcionalidade não encontrada"], null)
      }

      const profile = await this.featureRepo.findProfileById(input.profileId)
      if (!profile) {
        return new Output(false, [], ["Perfil não encontrado"], null)
      }

      if (!profile.isMaster || profile.role !== "manager") {
        return new Output(false, [], ["Apenas usuários master podem ser adicionados ao grupo beta"], null)
      }

      if (input.betaTeamScope === "SPECIFIC_TEAMS") {
        if (!input.teamIds || input.teamIds.length === 0) {
          return new Output(false, [], ["Selecione ao menos um time"], null)
        }

        const teamsValid = await this.featureRepo.validateTeamsBelongToMaster(
          input.profileId,
          input.teamIds
        )
        if (!teamsValid) {
          return new Output(false, [], ["Um ou mais times não pertencem a este master"], null)
        }
      }

      const grant = await this.featureRepo.upsertBetaGrant({
        featureId,
        profileId: input.profileId,
        betaTeamScope: input.betaTeamScope,
        teamIds: input.teamIds,
      })

      return new Output(true, ["Usuário beta vinculado com sucesso"], [], this.mapBetaGrant(grant))
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][addBetaUser]", error)
      return new Output(false, [], ["Erro ao vincular usuário beta"], null)
    }
  }

  async updateBetaUser(
    featureId: string,
    profileId: string,
    input: Pick<AddBetaUserInput, "betaTeamScope" | "teamIds">
  ): Promise<Output> {
    try {
      const feature = await this.featureRepo.findById(featureId)
      if (!feature) {
        return new Output(false, [], ["Funcionalidade não encontrada"], null)
      }

      const profile = await this.featureRepo.findProfileById(profileId)
      if (!profile?.isMaster || profile.role !== "manager") {
        return new Output(false, [], ["Grant beta não encontrado para este master"], null)
      }

      if (input.betaTeamScope === "SPECIFIC_TEAMS") {
        if (!input.teamIds || input.teamIds.length === 0) {
          return new Output(false, [], ["Selecione ao menos um time"], null)
        }

        const teamsValid = await this.featureRepo.validateTeamsBelongToMaster(profileId, input.teamIds)
        if (!teamsValid) {
          return new Output(false, [], ["Um ou mais times não pertencem a este master"], null)
        }
      }

      const grant = await this.featureRepo.upsertBetaGrant({
        featureId,
        profileId,
        betaTeamScope: input.betaTeamScope,
        teamIds: input.teamIds,
      })

      return new Output(true, ["Escopo beta atualizado com sucesso"], [], this.mapBetaGrant(grant))
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][updateBetaUser]", error)
      return new Output(false, [], ["Erro ao atualizar escopo beta"], null)
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
      return new Output(true, [], [], grants.map((grant) => this.mapBetaGrant(grant)))
    } catch (error) {
      console.error("[BackofficeFeatureUseCase][listBetaUsers]", error)
      return new Output(false, [], ["Erro ao listar usuários beta"], null)
    }
  }

  private mapBetaGrant(
    grant: Awaited<ReturnType<IBackofficeFeatureRepository["upsertBetaGrant"]>>
  ) {
    return {
      id: grant.id,
      profileId: grant.profileId,
      isActive: grant.isActive,
      betaTeamScope: grant.betaTeamScope,
      teams: grant.teams.map((item) => ({
        id: item.team.id,
        name: item.team.name,
      })),
      profile: grant.profile,
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
  backofficeFeatureRepository
)
