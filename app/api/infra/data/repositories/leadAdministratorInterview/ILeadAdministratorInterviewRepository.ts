export type LeadAdministratorInterviewRecord = {
  leadId: string
  scheduledAt: string
  /** Como o usuário digitou: "AAAA-MM-DDTHH:mm". */
  scheduledLocal: string
  administratorName: string | null
  notes: string | null
  clientNotifiedAt: string | null
  updatedAt: string
}

export type SaveLeadAdministratorInterviewInput = {
  leadId: string
  teamId: string
  scheduledAt: Date
  scheduledLocal: string
  administratorName: string | null
  notes: string | null
  updatedByProfileId: string
}

export interface ILeadAdministratorInterviewRepository {
  findLead(leadId: string): Promise<{ teamId: string | null; name: string } | null>
  findByLeadId(leadId: string): Promise<LeadAdministratorInterviewRecord | null>
  save(input: SaveLeadAdministratorInterviewInput): Promise<LeadAdministratorInterviewRecord>
  markClientNotified(leadId: string, notifiedAt: Date): Promise<LeadAdministratorInterviewRecord>
  deleteByLeadId(leadId: string): Promise<void>
}
