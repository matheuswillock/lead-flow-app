import { BackofficeLeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import type {
  BackofficeLeadSchedulePayload,
  IBackofficeLeadScheduleUseCase,
} from "./IBackofficeLeadScheduleUseCase"
import type { IBackofficeLeadUseCase } from "@/app/api/useCases/backofficeLead/IBackofficeLeadUseCase"
import { backofficeLeadUseCase } from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"
import type { IBackofficeLeadScheduleService } from "@/app/api/services/Backoffice/backofficeLeadSchedule/IBackofficeLeadScheduleService"
import { backofficeLeadScheduleService } from "./backofficeLeadScheduleService"

function stringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export class BackofficeLeadScheduleUseCase implements IBackofficeLeadScheduleUseCase {
  constructor(
    private readonly leadUseCase: IBackofficeLeadUseCase,
    private readonly scheduleService: IBackofficeLeadScheduleService
  ) {}

  async listSchedules(leadId: string): Promise<Output> {
    return this.scheduleService.listSchedules(leadId)
  }

  async scheduleLead(params: { leadId: string; payload: BackofficeLeadSchedulePayload }) {
    const body = params.payload ?? {}
    return this.leadUseCase.updateLeadStatus(params.leadId, BackofficeLeadStatus.scheduled, {
      closerBackofficeUserId: (body as any)?.closerBackofficeUserId ?? null,
      meetingDate: (body as any)?.meetingDate ?? null,
      meetingTitle: (body as any)?.meetingTitle ?? null,
      meetingNotes: (body as any)?.meetingNotes ?? null,
      meetingLink: (body as any)?.meetingLink ?? null,
      meetingType: (body as any)?.meetingType ?? null,
      meetingExtraGuests: stringArray((body as any)?.meetingExtraGuests) ??
        stringArray((body as any)?.extraGuests),
    })
  }

  async cancelSchedule(params: {
    leadId: string
    canceledByProfileId: string
    reason: unknown
  }): Promise<Output> {
    const cancelOutput = await this.scheduleService.cancelSchedule({
      leadId: params.leadId,
      canceledByProfileId: params.canceledByProfileId,
      reason: typeof params.reason === "string" ? params.reason : null,
    })

    if (!cancelOutput.isValid) return cancelOutput

    const leadOutput = await this.leadUseCase.updateLeadStatus(
      params.leadId,
      BackofficeLeadStatus.new_opportunity,
      {
        closerBackofficeUserId: null,
        meetingDate: null,
        meetingTitle: null,
        meetingNotes: null,
        meetingLink: null,
        meetingType: null,
        meetingExtraGuests: [],
      }
    )

    if (!leadOutput.isValid) return leadOutput

    return new Output(true, cancelOutput.successMessages, [], {
      cancel: cancelOutput.result,
      lead: leadOutput.result,
    })
  }

  async getAttendees(leadId: string): Promise<Output> {
    return this.scheduleService.getAttendees({ leadId })
  }

  async resendInvite(params: {
    leadId: string
    target: "all" | "single" | "new"
    email?: string
    emails?: string[]
  }): Promise<Output> {
    return this.scheduleService.resendInvite(params)
  }
}

export const backofficeLeadScheduleUseCase = new BackofficeLeadScheduleUseCase(
  backofficeLeadUseCase,
  backofficeLeadScheduleService
)
