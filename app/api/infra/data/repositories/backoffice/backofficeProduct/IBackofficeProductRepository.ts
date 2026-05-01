import type {
  BackofficeProduct,
  BackofficeProductBillingMode,
  BackofficeProductType,
} from "@prisma/client"

export interface CreateBackofficeProductInput {
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

export interface UpdateBackofficeProductInput {
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

export interface IBackofficeProductRepository {
  findAll(): Promise<BackofficeProduct[]>
  findById(id: string): Promise<BackofficeProduct | null>
  findBySlug(slug: string): Promise<BackofficeProduct | null>
  create(data: CreateBackofficeProductInput): Promise<BackofficeProduct>
  update(id: string, data: UpdateBackofficeProductInput): Promise<BackofficeProduct>
  delete(id: string): Promise<void>
  hasActiveSubscriptions(id: string): Promise<boolean>
}
