import type { BackofficeProductItem, BackofficeProductFormData } from "../context/BackofficePricingTypes"

export interface IBackofficePricingService {
  list(): Promise<BackofficeProductItem[]>
  listFeatureSlugs(): Promise<string[]>
  create(data: BackofficeProductFormData): Promise<BackofficeProductItem>
  update(id: string, data: Partial<BackofficeProductFormData>): Promise<BackofficeProductItem>
  delete(id: string): Promise<void>
}
