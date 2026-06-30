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
}

export interface BackofficeProductDTO {
  id: string
  name: string
  featureSlug: string
  description: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly: number | null
  priceQuarterly: number | null
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
  featureSlug: string
  description?: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
  priceSemiannual?: number | null
  priceAnnual?: number | null
  priceLifetime?: number | null
  isDefault?: boolean
  isActive?: boolean
  paymentRules?: UpsertPaymentRuleInput[]
}

export interface UpdateBackofficeProductUseCaseInput {
  name?: string
  featureSlug?: string
  description?: string | null
  type?: BackofficeProductType
  billingMode?: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
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
      if (!input.featureSlug?.trim()) {
        return new Output(false, [], ["Slug é obrigatório"], null)
      }

      const featureSlug = input.featureSlug.trim()
      const feature = await this.featureRepo.findBySlug(featureSlug)
      if (!feature) {
        return new Output(false, [], ["Slug inválido: selecione um slug de funcionalidade"], null)
      }

      const validationError = this.validatePrices(input.billingMode, input)
      if (validationError) {
        return new Output(false, [], [validationError], null)
      }

      const existingCount = await this.productRepo.countByFeatureSlug(featureSlug)
      const isDefault = existingCount === 0 ? true : (input.isDefault ?? false)

      if (isDefault) {
        await this.productRepo.clearDefaultForFeatureSlug(featureSlug)
      }

      const product = await this.productRepo.create({ ...input, featureSlug, isDefault })
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

      if (input.featureSlug && input.featureSlug !== existing.featureSlug) {
        const feature = await this.featureRepo.findBySlug(input.featureSlug.trim())
        if (!feature) {
          return new Output(false, [], ["Slug inválido: selecione um slug de funcionalidade"], null)
        }
      }

      const billingMode = input.billingMode ?? existing.billingMode
      const validationError = this.validatePrices(billingMode, {
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
      })
      if (validationError) {
        return new Output(false, [], [validationError], null)
      }

      const targetFeatureSlug = input.featureSlug?.trim() ?? existing.featureSlug
      const willBeDefault = input.isDefault === true

      if (willBeDefault) {
        await this.productRepo.clearDefaultForFeatureSlug(targetFeatureSlug, id)
      } else if (input.isDefault === false && existing.isDefault) {
        const siblings = await this.productRepo.findByFeatureSlug(targetFeatureSlug)
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
      const product = await this.productRepo.update(id, productInput)
      if (paymentRules?.length) {
        await this.productRepo.upsertPaymentRules(id, paymentRules)
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
        const siblings = await this.productRepo.findByFeatureSlug(existing.featureSlug)
        const nextDefault = siblings.find((s) => s.isActive)
        if (nextDefault) {
          await this.productRepo.clearDefaultForFeatureSlug(existing.featureSlug)
          await this.productRepo.update(nextDefault.id, { isDefault: true })
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
      priceSemiannual?: number | null
      priceAnnual?: number | null
      priceLifetime?: number | null
    }
  ): string | null {
    if (billingMode === "RECURRING") {
      if (!prices.priceMonthly || prices.priceMonthly <= 0) {
        return "Preço mensal é obrigatório para produtos recorrentes"
      }
      if (!prices.priceQuarterly || prices.priceQuarterly <= 0) {
        return "Preço trimestral é obrigatório para produtos recorrentes"
      }
      if (!prices.priceSemiannual || prices.priceSemiannual <= 0) {
        return "Preço semestral é obrigatório para produtos recorrentes"
      }
      if (!prices.priceAnnual || prices.priceAnnual <= 0) {
        return "Preço anual é obrigatório para produtos recorrentes"
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
  return {
    paymentMethod: rule.paymentMethod,
    billingCycle: rule.billingCycle,
    price: Number(rule.price.toString()),
    canInstallment: rule.canInstallment,
    maxInstallments: rule.maxInstallments,
  }
}

export function mapProductDTO(product: BackofficeProduct): BackofficeProductDTO {
  return {
    id: product.id,
    name: product.name,
    featureSlug: product.featureSlug,
    description: product.description,
    type: product.type,
    billingMode: product.billingMode,
    priceMonthly: decimalToNumber(product.priceMonthly),
    priceQuarterly: decimalToNumber(product.priceQuarterly),
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
