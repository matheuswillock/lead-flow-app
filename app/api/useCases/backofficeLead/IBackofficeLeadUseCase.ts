import type { BackofficeLeadOrigin, BackofficeLeadStatus } from "@prisma/client"
import type { Output } from "@/lib/output"

export interface CreateBackofficeLeadDTO {
  name: string
  email?: string | null
  phone?: string | null
  cpfCnpj?: string | null
  notes?: string | null
  status?: BackofficeLeadStatus
  origin?: BackofficeLeadOrigin
  sourceExternalId?: string | null
  sourceWebhookEventId?: string | null
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  meetingDate?: string | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
  meetingType?: string | null
  meetingExtraGuests?: string[] | null
  qualificationLeadOrganization?: string | null
  qualificationAvgUsers?: string | null
  qualificationProfileFit?: string | null
}

export interface UpdateBackofficeLeadDTO {
  name?: string
  email?: string | null
  phone?: string | null
  cpfCnpj?: string | null
  notes?: string | null
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  meetingDate?: string | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
  meetingType?: string | null
  meetingExtraGuests?: string[] | null
  qualificationLeadOrganization?: string | null
  qualificationAvgUsers?: string | null
  qualificationProfileFit?: string | null
}

export interface UpdateBackofficeLeadStatusDTO {
  closerBackofficeUserId?: string | null
  meetingDate?: string | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
  meetingType?: string | null
  meetingExtraGuests?: string[] | null
}

export interface IBackofficeLeadUseCase {
  listLeads(params?: { status?: BackofficeLeadStatus }): Promise<Output>
  getLeadById(id: string): Promise<Output>
  createLead(data: CreateBackofficeLeadDTO, createdByProfileId: string): Promise<Output>
  updateLead(id: string, data: UpdateBackofficeLeadDTO): Promise<Output>
  updateLeadStatus(
    id: string,
    status: BackofficeLeadStatus,
    data?: UpdateBackofficeLeadStatusDTO
  ): Promise<Output>
  deleteLead(id: string): Promise<Output>
}
