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

/**
 * Identidade **digitada** nas respostas da sessão (perguntas com
 * `mappingTarget: native_field` e `mappingKey` name/phone/email), lida da
 * submissão em andamento. O perfil que chega ao gate é o do destinatário do
 * e-mail; só a submissão sabe quem de fato respondeu.
 */
export type RadarSubmittedIdentity = {
  name: string | null
  phone: string | null
  email: string | null
  /** Lead que esta sessão já materializou — âncora de idempotência do gate. */
  sessionLeadId: string | null
}

export type RadarLeadIdentity = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}

/** Encaminhamento detectado: quem respondeu não é o contato do `cs_el`. */
export type RadarLeadGateReferral = {
  reason: "typed_identity_divergence"
  referralOfLeadId: string
  referralOfRadarProfileId: string
  referralOfEmailLogId: string | null
  referralOfCampaignId: string | null
}

export interface IPublicFormFactsRepository {
  attachLeadToPendingSubmissions(input: {
    formId: string
    visitorSessionId: string
    leadId: string
    /**
     * Lead do qual a submissão deve ser **retirada** além do caso `leadId`
     * nulo. Só a divergência de identidade usa: a sessão pode ter sido anexada
     * ao lead do destinatário numa resposta anterior (identidade ainda
     * incompleta), e sem isso a submissão ficaria no card errado e cada revisão
     * seguinte criaria mais um lead de indicação.
     */
    replaceLeadId?: string | null
  }): Promise<void>
  findSubmittedIdentity(input: {
    formId: string
    visitorSessionId: string
  }): Promise<RadarSubmittedIdentity | null>
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
  findLeadIdentity(input: { teamId: string; leadId: string }): Promise<RadarLeadIdentity | null>
  createOrUpdateFromRadarProfile(input: {
    teamId: string
    formId: string
    profile: RadarLeadGateProfile
    existingLeadId: string | null
    origin: Record<string, unknown>
    referral?: RadarLeadGateReferral | null
    /**
     * Semente do `leadCode` quando o lead nasce fora do par 1:1 com o perfil.
     * `Lead.leadCode` é `@unique` global: no caminho de divergência o mesmo
     * perfil promove um segundo lead, e derivar o código só do perfil colidiria
     * (P2002) com o card do destinatário.
     */
    leadCodeSeed?: string | null
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
