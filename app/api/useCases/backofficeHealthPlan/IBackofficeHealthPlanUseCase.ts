import { Output } from "@/lib/output"

export interface IBackofficeHealthPlanUseCase {
  list(includeInactive: boolean): Promise<Output>
  create(input: { name: string; iconUrl?: string | null; isDefault?: boolean; createdBy?: string | null }): Promise<Output>
  update(
    id: string,
    input: { name?: string; iconUrl?: string | null; isDefault?: boolean; isActive?: boolean },
    actor?: { email?: string; password?: string }
  ): Promise<Output>
  deactivate(id: string, actor?: { email?: string; password?: string }): Promise<Output>
}
