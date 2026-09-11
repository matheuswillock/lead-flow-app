import type { LeadStatus } from "@prisma/client"

export type RadarLeadGateProfile = {
  id: string
  teamId: string
  displayName: string
  normalizedName: string
  displayPhone: string | null
  normalizedPhone: string | null
  primaryEmail: string | null
  normalizedPrimaryEmail: string | null
  /** Lead do vínculo `lead_id` MAIS RECENTE do perfil — não é mais 1:1 (ver [[RadarCrmIdentityMatch]]). */
  leadId: string | null
}

/**
 * Candidato a lead casado, com status — a regra 1 (adenda 31/08) só anexa
 * quando o candidato está em `new_opportunity`; em qualquer outro status o
 * gate materializa um card novo.
 */
export type RadarCrmIdentityMatchCandidate = {
  leadId: string
  /** `null` = lead ainda em rascunho (`Lead.status` é opcional) — nunca é `new_opportunity`, então também não recebe anexo. */
  status: LeadStatus | null
} | null

export type RadarCrmIdentityMatch = {
  leadIdMatch: RadarCrmIdentityMatchCandidate
  phoneMatch: RadarCrmIdentityMatchCandidate
  emailMatch: RadarCrmIdentityMatchCandidate
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
  /** Submissão corrente da sessão — escopo de toda reatribuição do gate. */
  submissionId: string
  /** Lead que esta sessão já materializou — âncora de idempotência do gate. */
  sessionLeadId: string | null
}

export type RadarLeadIdentity = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  /**
   * Perfil de origem quando este lead nasceu como indicação deste gate
   * (`originMetadata.referral.referralOfRadarProfileId`). É o que distingue
   * "card que nós criamos para esta sessão" de "lead que outro fluxo anexou" —
   * só o primeiro pode ser remanejado por uma revisão de identidade.
   */
  referralOfRadarProfileId: string | null
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
     * nulo. A sessão pode ter sido anexada ao lead do destinatário numa
     * resposta anterior (identidade ainda incompleta), e sem isso a submissão
     * ficaria no card errado e cada revisão seguinte criaria mais um lead.
     *
     * Exige `submissionId`: uma sessão longa pode ter conversões antigas já
     * concluídas no mesmo formulário, e um `updateMany` por sessão arrastaria
     * o histórico junto.
     */
    replaceLeadId?: string | null
    /** Submissão corrente — obrigatória para qualquer reatribuição. */
    submissionId?: string | null
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
