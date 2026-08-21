export type RadarLeadGateProfile = {
  id: string
  teamId: string
  displayName: string
  normalizedName: string
  displayPhone: string | null
  normalizedPhone: string | null
  primaryEmail: string | null
  normalizedPrimaryEmail: string | null
  leadId: string | null
}

export type RadarCrmIdentityMatch = {
  leadIdMatch: string | null
  phoneMatch: string | null
  emailMatch: string | null
}

export type RadarLeadGatePromotionResult = {
  leadId: string
  created: boolean
}

export interface IPublicFormFactsRepository {
  attachLeadToPendingSubmissions(input: {
    formId: string
    visitorSessionId: string
    leadId: string
  }): Promise<void>
}

export interface IRadarLeadGateProfileRepository {
  reloadProfile(teamId: string, radarProfileId: string): Promise<RadarLeadGateProfile | null>
  linkLeadIdentity(input: {
    teamId: string
    radarProfileId: string
    leadId: string
    source: string
  }): Promise<void>
  appendGateEvent(input: {
    teamId: string
    radarProfileId: string
    eventType: "radar.crm_identity_conflict" | "radar.crm_lead_created" | "radar.crm_lead_attached"
    eventId: string
    metadata: Record<string, string | boolean | null>
  }): Promise<void>
}

export interface IRadarCrmLeadPort {
  findIdentityMatches(profile: RadarLeadGateProfile): Promise<RadarCrmIdentityMatch>
  createOrUpdateFromRadarProfile(input: {
    teamId: string
    profile: RadarLeadGateProfile
    existingLeadId: string | null
  }): Promise<RadarLeadGatePromotionResult>
}

export type RadarLeadGateTransaction = IPublicFormFactsRepository &
  IRadarLeadGateProfileRepository &
  IRadarCrmLeadPort

export interface IRadarLeadGateUnitOfWork {
  execute<T>(
    input: { teamId: string; radarProfileId: string },
    work: (transaction: RadarLeadGateTransaction) => Promise<T>,
  ): Promise<T>
}
