import { Output } from "@/lib/output"
import { BackofficeProductRepository } from "../../infra/data/repositories/backoffice/backofficeProduct/BackofficeProductRepository"
import type {
  BackofficeProductWithPaymentRules,
  IBackofficeProductRepository,
  UpsertPaymentRuleInput,
} from "../../infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import type {
  BackofficePaymentMethod,
  BackofficeProduct,
  BackofficeProductBillingMode,
  BackofficeProductPaymentRule,
  BackofficeProductType,
} from "@prisma/client"
import { BackofficeFeatureRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeFeature/BackofficeFeatureRepository"
import type { IBackofficeFeatureRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeFeature/IBackofficeFeatureRepository"

export interface BackofficeProductPaymentRuleDTO {
  paymentMethod: BackofficePaymentMethod
  billingCycle: string
  price: number
  canInstallment: boolean
  maxInstallments: number
  installmentSplitMode: "EQUAL" | "CUSTOM"
  installmentSchedule: number[]
}

export interface BackofficeProductDTO {
  id: string
  name: string
  featureSlugs: string[]
  description: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly: number | null
  priceQuarterly: number | null
  priceQuadrimester: number | null
  priceSemiannual: number | null
  priceAnnual: number | null
  priceLifetime: number | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  paymentRules: BackofficeProductPaymentRuleDTO[]
}

export interface CreateBackofficeProductUseCaseInput {
  name: string
  featureSlugs: string[]
  description?: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
  priceQuadrimester?: number | null
  priceSemiannual?: number | null
  priceAnnual?: number | null
  priceLifetime?: number | null
  isDefault?: boolean
  isActive?: boolean
  paymentRules?: UpsertPaymentRuleInput[]
}

export interface UpdateBackofficeProductUseCaseInput {
  name?: string
  featureSlugs?: string[]
  description?: string | null
  type?: BackofficeProductType
  billingMode?: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
  priceQuadrimester?: number | null
  priceSemiannual?: number | null
  priceAnnual?: number | null
  priceLifetime?: number | null
  isDefault?: boolean
  isActive?: boolean
  paymentRules?: UpsertPaymentRuleInput[]
}

export class BackofficeProductUseCase {
  constructor(
    private productRepo: IBackofficeProductRepository,
    private featureRepo: IBackofficeFeatureRepository
  ) {}

  async list(): Promise<Output> {
    try {
      const products = await this.productRepo.findAllWithPaymentRules()
      return new Output(true, [], [], products.map(mapProductWithRulesDTO))
    } catch (error) {
      console.error("[BackofficeProductUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar produtos"], null)
    }
  }

  async listByFeatureSlug(featureSlug: string): Promise<Output> {
    try {
      const trimmed = featureSlug?.trim()
      if (!trimmed) {
        return new Output(false, [], ["Slug da funcionalidade é obrigatório"], null)
      }
      const products = await this.productRepo.findByFeatureSlugWithPaymentRules(trimmed)
      return new Output(true, [], [], products.map(mapProductWithRulesDTO))
    } catch (error) {
      console.error("[BackofficeProductUseCase][listByFeatureSlug]", error)
      return new Output(false, [], ["Erro ao listar variantes do produto"], null)
    }
  }

  async create(input: CreateBackofficeProductUseCaseInput): Promise<Output> {
    try {
      if (!input.name?.trim()) {
        return new Output(false, [], ["Nome é obrigatório"], null)
      }

      const featureSlugs = Array.from(
        new Set((input.featureSlugs ?? []).map((slug) => slug.trim()).filter(Boolean))
      )
      if (featureSlugs.length === 0) {
        return new Output(false, [], ["Selecione ao menos um slug de funcionalidade"], null)
      }

      for (const slug of featureSlugs) {
        const feature = await this.featureRepo.findBySlug(slug)
        if (!feature) {
          return new Output(false, [], [`Slug inválido: ${slug}`], null)
        }
      }

      const validationError = this.validatePrices(input.billingMode, input, input.paymentRules)
      if (validationError) {
        return new Output(false, [], [validationError], null)
      }

      if (input.billingMode === "RECURRING" && (!input.paymentRules || input.paymentRules.length === 0)) {
        return new Output(false, [], ["Informe ao menos uma regra de pagamento"], null)
      }

      const primarySlug = featureSlugs[0]
      const existingCount = await this.productRepo.countByFeatureSlug(primarySlug)
      const isDefault = existingCount === 0 ? true : (input.isDefault ?? false)

      if (isDefault) {
        for (const slug of featureSlugs) {
          await this.productRepo.clearDefaultForFeatureSlug(slug)
        }
      }

      const product = await this.productRepo.create({ ...input, featureSlugs, isDefault })
      if (input.billingMode === "RECURRING" && input.paymentRules?.length) {
        await this.productRepo.upsertPaymentRules(product.id, input.paymentRules)
      }
      const withRules = await this.productRepo.findByIdWithPaymentRules(product.id)
      return new Output(
        true,
        ["Produto criado com sucesso"],
        [],
        mapProductWithRulesDTO(withRules ?? { ...product, paymentRules: [] })
      )
    } catch (error) {
      console.error("[BackofficeProductUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar produto"], null)
    }
  }

  async update(id: string, input: UpdateBackofficeProductUseCaseInput): Promise<Output> {
    try {
      const existing = await this.productRepo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Produto não encontrado"], null)
      }

      if (input.featureSlugs) {
        const featureSlugs = Array.from(
          new Set(input.featureSlugs.map((slug) => slug.trim()).filter(Boolean))
        )
        if (featureSlugs.length === 0) {
          return new Output(false, [], ["Selecione ao menos um slug de funcionalidade"], null)
        }
        for (const slug of featureSlugs) {
          const feature = await this.featureRepo.findBySlug(slug)
          if (!feature) {
            return new Output(false, [], [`Slug inválido: ${slug}`], null)
          }
        }
      }

      const billingMode = input.billingMode ?? existing.billingMode
      const validationError = this.validatePrices(
        billingMode,
        {
          priceMonthly: Object.prototype.hasOwnProperty.call(input, "priceMonthly")
            ? input.priceMonthly
            : existing.priceMonthly !== null
              ? Number(existing.priceMonthly)
              : null,
          priceQuarterly: Object.prototype.hasOwnProperty.call(input, "priceQuarterly")
            ? input.priceQuarterly
            : existing.priceQuarterly !== null
              ? Number(existing.priceQuarterly)
              : null,
          priceQuadrimester: Object.prototype.hasOwnProperty.call(input, "priceQuadrimester")
            ? input.priceQuadrimester
            : existing.priceQuadrimester !== null
              ? Number(existing.priceQuadrimester)
              : null,
          priceSemiannual: Object.prototype.hasOwnProperty.call(input, "priceSemiannual")
            ? input.priceSemiannual
            : existing.priceSemiannual !== null
              ? Number(existing.priceSemiannual)
              : null,
          priceAnnual: Object.prototype.hasOwnProperty.call(input, "priceAnnual")
            ? input.priceAnnual
            : existing.priceAnnual !== null
              ? Number(existing.priceAnnual)
              : null,
          priceLifetime: Object.prototype.hasOwnProperty.call(input, "priceLifetime")
            ? input.priceLifetime
            : existing.priceLifetime !== null
              ? Number(existing.priceLifetime)
              : null,
        },
        input.paymentRules
      )
      if (validationError) {
        return new Output(false, [], [validationError], null)
      }

      const targetFeatureSlugs = input.featureSlugs?.length
        ? Array.from(new Set(input.featureSlugs.map((slug) => slug.trim()).filter(Boolean)))
        : existing.featureSlugs
      const primarySlug = targetFeatureSlugs[0]
      const willBeDefault = input.isDefault === true

      if (willBeDefault) {
        for (const slug of targetFeatureSlugs) {
          await this.productRepo.clearDefaultForFeatureSlug(slug, id)
        }
      } else if (input.isDefault === false && existing.isDefault) {
        const siblings = await this.productRepo.findByFeatureSlug(primarySlug)
        const otherActive = siblings.filter((s) => s.id !== id && s.isActive)
        if (otherActive.length === 0) {
          return new Output(
            false,
            [],
            ["Não é possível remover o padrão: este é o único produto ativo do slug"],
            null
          )
        }
      }

      const { paymentRules, ...productInput } = input

      if (paymentRules) {
        const lockedCycles = await this.productRepo.findLockedBillingCycles(id)
        const locked = new Set(lockedCycles)
        const existingWithRules = await this.productRepo.findByIdWithPaymentRules(id)
        const existingRules = existingWithRules?.paymentRules ?? []
        const incomingKeys = new Set(
          paymentRules.map((rule) => `${rule.paymentMethod}:${rule.billingCycle}`)
        )
        const blockedRemovals = existingRules
          .filter((rule) => !incomingKeys.has(`${rule.paymentMethod}:${rule.billingCycle}`))
          .filter((rule) => locked.has(rule.billingCycle as "monthly" | "quarterly" | "quadrimester" | "semiannual" | "annual"))
          .map((rule) => rule.billingCycle)
        const blockedUpdates: string[] = []
        for (const rule of paymentRules) {
          if (!locked.has(rule.billingCycle)) continue
          const current = existingRules.find(
            (item) =>
              item.paymentMethod === rule.paymentMethod && item.billingCycle === rule.billingCycle
          )
          if (!current) continue
          const scheduleChanged =
            JSON.stringify(current.installmentSchedule ?? []) !==
            JSON.stringify(rule.installmentSchedule ?? [])
          if (
            Number(current.price.toString()) !== rule.price ||
            (current.installmentSplitMode ?? "EQUAL") !== (rule.installmentSplitMode ?? "EQUAL") ||
            (current.canInstallment ?? false) !== (rule.canInstallment ?? false) ||
            current.maxInstallments !== rule.maxInstallments ||
            scheduleChanged
          ) {
            blockedUpdates.push(rule.billingCycle)
          }
        }
        if (blockedRemovals.length || blockedUpdates.length) {
          const parts = [
            ...Array.from(new Set(blockedUpdates)).map(
              (cycle) => `ciclo ${cycle} em uso não pode ter preço/parcelas alterados`
            ),
            ...Array.from(new Set(blockedRemovals)).map(
              (cycle) => `ciclo ${cycle} em uso não pode ser removido`
            ),
          ]
          return new Output(false, [], [parts.join("; ")], null)
        }
      }

      const product = await this.productRepo.update(id, productInput)
      if (paymentRules) {
        const lockedCycles = await this.productRepo.findLockedBillingCycles(id)
        await this.productRepo.syncPaymentRules(id, paymentRules, lockedCycles)
      }
      const withRules = await this.productRepo.findByIdWithPaymentRules(id)
      return new Output(
        true,
        ["Produto atualizado com sucesso"],
        [],
        mapProductWithRulesDTO(withRules ?? { ...product, paymentRules: [] })
      )
    } catch (error) {
      console.error("[BackofficeProductUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar produto"], null)
    }
  }

  async delete(id: string): Promise<Output> {
    try {
      const existing = await this.productRepo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Produto não encontrado"], null)
      }

      const hasSubscriptions = await this.productRepo.hasActiveSubscriptions(id)
      if (hasSubscriptions) {
        return new Output(
          false,
          [],
          ["Não é possível excluir um produto com assinaturas ativas"],
          null
        )
      }

      await this.productRepo.delete(id)

      if (existing.isDefault) {
        const primarySlug = existing.featureSlugs[0]
        if (primarySlug) {
          const siblings = await this.productRepo.findByFeatureSlug(primarySlug)
          const nextDefault = siblings.find((s) => s.isActive)
          if (nextDefault) {
            await this.productRepo.clearDefaultForFeatureSlug(primarySlug)
            await this.productRepo.update(nextDefault.id, { isDefault: true })
          }
        }
      }

      return new Output(true, ["Produto excluído com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeProductUseCase][delete]", error)
      return new Output(false, [], ["Erro ao excluir produto"], null)
    }
  }

  private validatePrices(
    billingMode: BackofficeProductBillingMode,
    prices: {
      priceMonthly?: number | null
      priceQuarterly?: number | null
      priceQuadrimester?: number | null
      priceSemiannual?: number | null
      priceAnnual?: number | null
      priceLifetime?: number | null
    },
    paymentRules?: UpsertPaymentRuleInput[]
  ): string | null {
    if (billingMode === "RECURRING") {
      const hasRule = (paymentRules?.length ?? 0) > 0
      const hasFlat =
        (prices.priceMonthly != null && prices.priceMonthly > 0) ||
        (prices.priceQuarterly != null && prices.priceQuarterly > 0) ||
        (prices.priceQuadrimester != null && prices.priceQuadrimester > 0) ||
        (prices.priceSemiannual != null && prices.priceSemiannual > 0) ||
        (prices.priceAnnual != null && prices.priceAnnual > 0)
      if (!hasRule && !hasFlat) {
        return "Informe ao menos um ciclo com preço para produtos recorrentes"
      }
      if (paymentRules?.length) {
        for (const rule of paymentRules) {
          if (!rule.price || rule.price <= 0) {
            return `Preço inválido na regra ${rule.paymentMethod}/${rule.billingCycle}`
          }
          if (rule.installmentSplitMode === "CUSTOM") {
            const schedule = rule.installmentSchedule ?? []
            const total = schedule.reduce((sum, value) => sum + value, 0)
            if (schedule.length === 0 || total <= 0) {
              return `Cronograma de parcelas inválido no ciclo ${rule.billingCycle}`
            }
            if (Math.abs(total - rule.price) > 0.01) {
              return `Soma das parcelas deve ser igual ao total no ciclo ${rule.billingCycle}`
            }
          }
        }
      }
    } else if (billingMode === "LIFETIME") {
      if (prices.priceLifetime != null && prices.priceLifetime <= 0) {
        return "Preço vitalício deve ser maior que zero"
      }
    }
    return null
  }
}

function decimalToNumber(value: { toString(): string } | null): number | null {
  return value == null ? null : Number(value.toString())
}

function mapPaymentRuleDTO(rule: BackofficeProductPaymentRule): BackofficeProductPaymentRuleDTO {
  const schedule = Array.isArray(rule.installmentSchedule) ? (rule.installmentSchedule as number[]) : []
  return {
    paymentMethod: rule.paymentMethod,
    billingCycle: rule.billingCycle,
    price: Number(rule.price.toString()),
    canInstallment: rule.canInstallment,
    maxInstallments: rule.maxInstallments,
    installmentSplitMode: rule.installmentSplitMode as "EQUAL" | "CUSTOM",
    installmentSchedule: schedule,
  }
}

export function mapProductDTO(product: BackofficeProduct): BackofficeProductDTO {
  return {
    id: product.id,
    name: product.name,
    featureSlugs: product.featureSlugs,
    description: product.description,
    type: product.type,
    billingMode: product.billingMode,
    priceMonthly: decimalToNumber(product.priceMonthly),
    priceQuarterly: decimalToNumber(product.priceQuarterly),
    priceQuadrimester: decimalToNumber(product.priceQuadrimester),
    priceSemiannual: decimalToNumber(product.priceSemiannual),
    priceAnnual: decimalToNumber(product.priceAnnual),
    priceLifetime: decimalToNumber(product.priceLifetime),
    isDefault: product.isDefault,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    paymentRules: [],
  }
}

export function mapProductWithRulesDTO(product: BackofficeProductWithPaymentRules): BackofficeProductDTO {
  return {
    ...mapProductDTO(product),
    paymentRules: product.paymentRules.map(mapPaymentRuleDTO),
  }
}

export const backofficeProductUseCase = new BackofficeProductUseCase(
  new BackofficeProductRepository(),
  new BackofficeFeatureRepository()
)
