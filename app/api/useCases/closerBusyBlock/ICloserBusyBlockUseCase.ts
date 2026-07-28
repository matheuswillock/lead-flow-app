import type { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { UpsertCloserBusyBlockInput } from "@/app/api/services/CloserBusyBlock/ICloserBusyBlockService"

export interface ICloserBusyBlockUseCase {
  list(params: {
    access: TeamAccess
    from: Date
    to: Date
    closerId?: string
  }): Promise<Output>
  create(params: {
    access: TeamAccess
    input: UpsertCloserBusyBlockInput
  }): Promise<Output>
  update(params: {
    access: TeamAccess
    id: string
    input: UpsertCloserBusyBlockInput
  }): Promise<Output>
  remove(params: { access: TeamAccess; id: string }): Promise<Output>
}
