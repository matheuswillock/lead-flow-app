export interface SubmitBackofficePublicLeadPayload {
  name: string
  email?: string
  phone?: string
  cpfCnpj?: string
  notes?: string
  qualificationLeadOrganization?: string
  qualificationAvgUsers?: string
  qualificationProfileFit?: string
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
}

export interface IBackofficePublicLeadFormService {
  submitLead(payload: SubmitBackofficePublicLeadPayload): Promise<SubmitBackofficePublicLeadResult>
}
