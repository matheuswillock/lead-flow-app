import type { Output } from "@/lib/output"

export interface CreatePublicBackofficeLeadFormInput {
  name: string
  email?: string | null
  phone?: string | null
  cpfCnpj?: string | null
  notes?: string | null
  qualificationLeadOrganization?: string | null
  qualificationAvgUsers?: string | null
  qualificationProfileFit?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  landingUrl?: string | null
  referrer?: string | null
  closerBackofficeUserId?: string | null
  meetingDate?: string | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingType?: "online" | "call" | "whatsapp" | null
}

export interface IBackofficePublicLeadFormUseCase {
  create(input: CreatePublicBackofficeLeadFormInput): Promise<Output>
}
