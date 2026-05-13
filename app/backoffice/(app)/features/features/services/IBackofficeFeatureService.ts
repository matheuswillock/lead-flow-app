import type { BackofficeFeatureFormData, BackofficeFeatureItem } from "../context/BackofficeFeatureTypes"

export interface IBackofficeFeatureService {
  list(): Promise<BackofficeFeatureItem[]>
  create(formData: BackofficeFeatureFormData): Promise<BackofficeFeatureItem>
  update(id: string, formData: Partial<BackofficeFeatureFormData>): Promise<BackofficeFeatureItem>
  delete(id: string): Promise<void>
}
