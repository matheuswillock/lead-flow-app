import type { UserRole } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { Output } from "@/lib/output"
import type {
  PublicFormDraftInput,
  PublicFormListFilters,
  PublicFormMetricEventInput,
} from "@/lib/public-forms/types"

export interface IPublicFormsUseCase {
  list(access: TeamAccess, filters: PublicFormListFilters): Promise<Output>
  listPublishedOptions(access: TeamAccess): Promise<Output>
  get(access: TeamAccess, id: string): Promise<Output>
  create(access: TeamAccess, input: PublicFormDraftInput): Promise<Output>
  update(access: TeamAccess, id: string, input: PublicFormDraftInput): Promise<Output>
  duplicate(access: TeamAccess, id: string): Promise<Output>
  submitApproval(access: TeamAccess, id: string): Promise<Output>
  approve(access: TeamAccess, id: string): Promise<Output>
  reject(access: TeamAccess, id: string, comment: string): Promise<Output>
  publish(access: TeamAccess, id: string): Promise<Output>
  archive(access: TeamAccess, id: string): Promise<Output>
  restore(access: TeamAccess, id: string): Promise<Output>
  getSettings(access: TeamAccess): Promise<Output>
  updateSettings(
    access: TeamAccess,
    input: {
      approvalRequired: boolean
      approverRoles: UserRole[]
      defaultBackgroundColor: string
      defaultTextColor: string
      defaultLineColor: string
    },
  ): Promise<Output>
  getPublic(publicId: string): Promise<Output>
  getAvailabilityContext(publicId: string): Promise<Output>
  recordMetric(publicId: string, input: PublicFormMetricEventInput): Promise<Output>
  persistQueuedMetric(publicId: string, input: PublicFormMetricEventInput): Promise<boolean>
  analytics(
    access: TeamAccess,
    id: string,
    from?: Date,
    to?: Date,
    publicationId?: string,
  ): Promise<Output>
  topConverting(access: TeamAccess, from?: Date, to?: Date): Promise<Output>
  leadSubmissions(access: TeamAccess, leadId: string): Promise<Output>
  preview(access: TeamAccess, id: string): Promise<Output>
}
