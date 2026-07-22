export interface BackofficePublicCloserOption {
  id: string
  name: string
  timezone: string
  googleCalendarConnected: boolean
}

export interface SubmitBackofficePublicLeadPayload {
  name: string
  email?: string
  phone?: string
  cpfCnpj?: string
  notes?: string
  qualificationLeadOrganization?: string
  qualificationAvgUsers?: string
  qualificationProfileFit?: string
  closerBackofficeUserId?: string
  meetingDate?: string
  meetingTitle?: string
  meetingNotes?: string
  meetingType?: "online" | "call" | "whatsapp"
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  landingUrl?: string
  referrer?: string
}

export interface SubmitBackofficePublicLeadResult {
  id: string
  duplicated: boolean
  scheduled?: boolean
  meetingDate?: string | null
}

export interface IBackofficePublicLeadFormService {
  fetchClosers(): Promise<BackofficePublicCloserOption[]>
  fetchAvailability(input: {
    closerId: string
    date: string
    timezone?: string
  }): Promise<string[]>
  submitLead(payload: SubmitBackofficePublicLeadPayload): Promise<SubmitBackofficePublicLeadResult>
}
