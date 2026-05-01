import { Output } from "@/lib/output"
import { BackofficeProductRepository } from "../../infra/data/repositories/backoffice/backofficeProduct/BackofficeProductRepository"
import type { IBackofficeProductRepository } from "../../infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import type {
  BackofficeProduct,
  BackofficeProductBillingMode,
  BackofficeProductType,
} from "@prisma/client"

export interface BackofficeProductDTO {
  id: string
  name: string
  slug: string
  description: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly: number | null
  priceQuarterly: number | null
  priceSemiannual: number | null
  priceLifetime: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateBackofficeProductUseCaseInput {
  name: string
  slug: string
  description?: string | null
  type: BackofficeProductType
  billingMode: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
  priceSemiannual?: number | null
  priceLifetime?: number | null
  isActive?: boolean
}

export interface UpdateBackofficeProductUseCaseInput {
  name?: string
  slug?: string
  description?: string | null
  type?: BackofficeProductType
  billingMode?: BackofficeProductBillingMode
  priceMonthly?: number | null
  priceQuarterly?: number | null
  priceSemiannual?: number | null
  priceLifetime?: number | null
  isActive?: boolean
}

export class BackofficeProductUseCase {
  constructor(private productRepo: IBackofficeProductRepository) {}

  async list(): Promise<Output> {
    try {
      const products = await this.productRepo.findAll()
      return new Output(true, [], [], products.map(mapProductDTO))
    } catch (error) {
      console.error("[BackofficeProductUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar produtos"], null)
    }
  }

  async create(input: CreateBackofficeProductUseCaseInput): Promise<Output> {
    try {
      if (!input.name?.trim()) {
        return new Output(false, [], ["Nome é obrigatório"], null)
      }
      if (!input.slug?.trim()) {
        return new Output(false, [], ["Slug é obrigatório"], null)
      }

      const existing = await this.productRepo.findBySlug(input.slug)
      if (existing) {
        return new Output(false, [], ["Já existe um produto com este slug"], null)
      }

      const validationError = this.validatePrices(input.billingMode, input)
      if (validationError) {
        return new Output(false, [], [validationError], null)
      }

      const product = await this.productRepo.create(input)
      return new Output(true, ["Produto criado com sucesso"], [], mapProductDTO(product))
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

      if (input.slug && input.slug !== existing.slug) {
        const slugConflict = await this.productRepo.findBySlug(input.slug)
        if (slugConflict) {
          return new Output(false, [], ["Já existe um produto com este slug"], null)
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
        priceLifetime: Object.prototype.hasOwnProperty.call(input, "priceLifetime")
          ? input.priceLifetime
          : existing.priceLifetime !== null
            ? Number(existing.priceLifetime)
            : null,
      })
      if (validationError) {
        return new Output(false, [], [validationError], null)
      }

      const product = await this.productRepo.update(id, input)
      return new Output(true, ["Produto atualizado com sucesso"], [], mapProductDTO(product))
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

export function mapProductDTO(product: BackofficeProduct): BackofficeProductDTO {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    type: product.type,
    billingMode: product.billingMode,
    priceMonthly: decimalToNumber(product.priceMonthly),
    priceQuarterly: decimalToNumber(product.priceQuarterly),
    priceSemiannual: decimalToNumber(product.priceSemiannual),
    priceLifetime: decimalToNumber(product.priceLifetime),
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

export const backofficeProductUseCase = new BackofficeProductUseCase(
  new BackofficeProductRepository()
)
