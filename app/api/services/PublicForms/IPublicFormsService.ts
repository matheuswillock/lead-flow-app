import type { PublicFormApprovalStatus, PublicFormStatus, UserRole } from "@prisma/client"
import type {
  PublicFormDraftInput,
  PublicFormListFilters,
  PublicFormMetricEventInput,
} from "@/lib/public-forms/types"

export interface IPublicFormsService {
  list(teamId: string, filters: PublicFormListFilters): Promise<unknown>
  listPublishedOptions(teamId: string): Promise<unknown>
  get(teamId: string, id: string): Promise<unknown>
  create(teamId: string, profileId: string, input: PublicFormDraftInput): Promise<unknown>
  update(teamId: string, id: string, input: PublicFormDraftInput): Promise<unknown>
  duplicate(teamId: string, id: string, profileId: string): Promise<unknown>
  transition(
    teamId: string,
    id: string,
    input: {
      status?: PublicFormStatus
      approvalStatus?: PublicFormApprovalStatus
      reviewedById?: string
      reviewComment?: string | null
    },
  ): Promise<unknown>
  publish(teamId: string, id: string, profileId: string): Promise<unknown>
  getSettings(teamId: string): Promise<unknown>
  updateSettings(
    teamId: string,
    input: {
      approvalRequired: boolean
      approverRoles: UserRole[]
      defaultBackgroundColor: string
      defaultTextColor: string
      defaultLineColor: string
      defaultAccentColor: string
      defaultButtonTextColor: string
      defaultInputBackgroundColor: string
    },
  ): Promise<unknown>
  getPublic(publicId: string): Promise<unknown>
  getAvailabilityContext(publicId: string): Promise<unknown>
  recordMetric(publicId: string, input: PublicFormMetricEventInput): Promise<boolean>
  analytics(
    teamId: string,
    id: string,
    from?: Date,
    to?: Date,
    publicationId?: string,
  ): Promise<unknown>
  listFormConversionTotals(
    teamId: string,
    options?: { from?: Date; to?: Date },
  ): Promise<Array<{ formId: string; name: string; viewed: number; completed: number }>>
  listLeadSubmissions(teamId: string, leadId: string): Promise<unknown>
}
