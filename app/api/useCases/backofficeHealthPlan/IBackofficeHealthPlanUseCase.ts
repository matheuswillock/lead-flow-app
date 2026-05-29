import { Output } from "@/lib/output"

export interface IBackofficeHealthPlanUseCase {
  list(includeInactive: boolean): Promise<Output>
  create(input: { name: string; iconUrl?: string | null; isDefault?: boolean; createdBy?: string | null }): Promise<Output>
  update(id: string, input: { name?: string; iconUrl?: string | null; isDefault?: boolean; isActive?: boolean }): Promise<Output>
  deactivate(id: string): Promise<Output>
}
