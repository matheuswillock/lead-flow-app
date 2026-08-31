import { createHash } from "node:crypto"
import { ActivityType, LeadStatus, Prisma, type PrismaClient } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IRadarLeadGateUnitOfWork,
  RadarCrmIdentityMatch,
  RadarLeadGateProfile,
  RadarLeadGateTransaction,
  RadarLeadGatePromotionResult,
  RadarLeadGateReferral,
  RadarLeadIdentity,
  RadarSubmittedIdentity,
} from "@/app/api/infra/data/repositories/radar/IRadarLeadGateUnitOfWork"
import { normalizeLeadPhoneDigits } from "@/lib/masks"
import { escapeLikePattern } from "@/lib/prisma/escape-like-pattern"
import {
  isPendingLeadIdentity,
  PENDING_LEAD_IDENTITY_PREFIX,
  PENDING_LEAD_IDENTITY_STALE_MS,
} from "@/lib/radar/lead-identity"

class PrismaRadarLeadGateTransaction implements RadarLeadGateTransaction {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  async reloadProfile(
    teamId: string,
    radarProfileId: string,
  ): Promise<RadarLeadGateProfile | null> {
    const profile = await this.transaction.radarProfile.findFirst({
      where: { id: radarProfileId, teamId },
      select: {
        id: true,
        teamId: true,
        displayName: true,
        normalizedName: true,
        displayPhone: true,
        normalizedPhone: true,
        primaryEmail: true,
        normalizedPrimaryEmail: true,
        identities: {
          // A reserva provisória da promoção também é `lead_id`, mas não é
          // vínculo — sem este filtro o `leadId` do gate viraria `pending:…`.
          where: {
            type: "lead_id",
            NOT: { normalizedValue: { startsWith: PENDING_LEAD_IDENTITY_PREFIX } },
          },
          select: { value: true, normalizedValue: true },
          take: 1,
        },
      },
    })
    if (!profile) return null

    const leadIdentity = profile.identities[0]
    return {
      id: profile.id,
      teamId: profile.teamId,
      displayName: profile.displayName,
      normalizedName: profile.normalizedName,
      displayPhone: profile.displayPhone,
      normalizedPhone: profile.normalizedPhone,
      primaryEmail: profile.primaryEmail,
      normalizedPrimaryEmail: profile.normalizedPrimaryEmail,
      leadId: leadIdentity?.value ?? leadIdentity?.normalizedValue ?? null,
    }
  }

  async findIdentityMatches(profile: RadarLeadGateProfile): Promise<RadarCrmIdentityMatch> {
    const normalizedPhone = normalizeLeadPhoneDigits(
      profile.normalizedPhone ?? profile.displayPhone ?? "",
    )
    const phoneSuffix = normalizedPhone.slice(-11)

    // O `escapeLikePattern` é obrigatório: sem ele o `mode: "insensitive"` vira
    // `ILIKE` com o valor cru e o `_` do e-mail do perfil casa o lead de outra
    // pessoa. Aqui isso é pior que uma leitura errada — `emailMatch` vira
    // `existingLeadId` em CreateCrmLeadFromRadarFormGateUseCase, e
    // `createOrUpdateFromRadarProfile` então grava nome, telefone e e-mail do
    // perfil POR CIMA do lead casado. Um perfil com `maria_silva@…`
    // sobrescrevia o cadastro de `maria.silva@…`.
    //
    // Escapar, e não comparar variantes literais, porque `Lead.email` é gravado
    // como veio: caixa mista divergente entre cadastro e perfil precisa
    // continuar casando, senão o gate cria um lead duplicado só por diferença
    // de caixa. Ver `lib/prisma/escape-like-pattern.ts`.
    const emailToMatch = (profile.normalizedPrimaryEmail ?? profile.primaryEmail)?.trim() || null

    const [leadIdMatch, phoneMatch, emailMatch] = await Promise.all([
      profile.leadId
        ? this.transaction.lead.findFirst({
            where: { id: profile.leadId, teamId: profile.teamId, deletedAt: null },
            select: { id: true },
          })
        : null,
      phoneSuffix.length >= 10
        ? this.transaction.lead.findFirst({
            where: {
              teamId: profile.teamId,
              deletedAt: null,
              OR: [
                ...(profile.displayPhone ? [{ phone: profile.displayPhone }] : []),
                ...(profile.normalizedPhone ? [{ phone: profile.normalizedPhone }] : []),
                { phone: { contains: phoneSuffix } },
              ],
            },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
        : null,
      emailToMatch
        ? this.transaction.lead.findFirst({
            where: {
              teamId: profile.teamId,
              deletedAt: null,
              email: { equals: escapeLikePattern(emailToMatch), mode: "insensitive" },
            },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
        : null,
    ])

    return {
      leadIdMatch: leadIdMatch?.id ?? null,
      phoneMatch: phoneMatch?.id ?? null,
      emailMatch: emailMatch?.id ?? null,
    }
  }

  async findLeadIdentity(input: {
    teamId: string
    leadId: string
  }): Promise<RadarLeadIdentity | null> {
    const lead = await this.transaction.lead.findFirst({
      where: { id: input.leadId, teamId: input.teamId, deletedAt: null },
      select: { id: true, name: true, phone: true, email: true },
    })
    if (!lead) return null
    return { id: lead.id, name: lead.name, phone: lead.phone, email: lead.email }
  }

  /**
   * Identidade digitada da sessão. Lê as respostas já persistidas pelo
   * `/progress` (o gate roda depois da gravação de cada campo), filtrando por
   * `mappingTarget: native_field` no snapshot da pergunta — o `mappingKey`
   * sozinho também existe em `custom_field` chamado "email".
   */
  async findSubmittedIdentity(input: {
    formId: string
    visitorSessionId: string
  }): Promise<RadarSubmittedIdentity | null> {
    const submission = await this.transaction.publicFormSubmission.findFirst({
      where: { formId: input.formId, visitorSessionId: input.visitorSessionId },
      orderBy: { createdAt: "desc" },
      select: {
        leadId: true,
        answers: {
          select: { value: true, mappingKey: true, questionSnapshot: true },
        },
      },
    })
    if (!submission) return null

    const identity: Record<string, string> = {}
    for (const answer of submission.answers) {
      const snapshot =
        answer.questionSnapshot && typeof answer.questionSnapshot === "object"
          ? (answer.questionSnapshot as Record<string, unknown>)
          : {}
      if (snapshot.mappingTarget !== "native_field") continue
      const mappingKey =
        answer.mappingKey ?? (typeof snapshot.mappingKey === "string" ? snapshot.mappingKey : null)
      if (mappingKey !== "name" && mappingKey !== "phone" && mappingKey !== "email") continue
      const value = typeof answer.value === "string" ? answer.value.trim() : ""
      if (!value) continue
      identity[mappingKey] = value
    }

    return {
      name: identity.name ?? null,
      phone: identity.phone ?? null,
      email: identity.email ?? null,
      sessionLeadId: submission.leadId,
    }
  }

  async createOrUpdateFromRadarProfile(input: {
    teamId: string
    formId: string
    profile: RadarLeadGateProfile
    existingLeadId: string | null
    origin: Record<string, unknown>
    referral?: RadarLeadGateReferral | null
    leadCodeSeed?: string | null
  }): Promise<RadarLeadGatePromotionResult> {
    const phone = input.profile.displayPhone ?? input.profile.normalizedPhone
    const email = input.profile.primaryEmail ?? input.profile.normalizedPrimaryEmail

    const form = await this.transaction.publicForm.findFirst({
      where: { id: input.formId, teamId: input.teamId },
      select: { assignedSdrId: true, name: true, publicId: true },
    })
    if (!form) throw new Error("Formulário do gate Radar não encontrado")

    const campaignId =
      typeof input.origin.campaignId === "string" ? input.origin.campaignId : null
    const emailLogId =
      typeof input.origin.emailLogId === "string" ? input.origin.emailLogId : null
    const fromEmailCampaign = Boolean(campaignId || emailLogId)

    if (input.existingLeadId) {
      await this.transaction.lead.update({
        where: { id: input.existingLeadId },
        data: {
          name: input.profile.displayName,
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          assignedTo: form.assignedSdrId ?? undefined,
          updatedAt: new Date(),
        },
      })
      return { leadId: input.existingLeadId, created: false }
    }

    const team = await this.transaction.team.findUnique({
      where: { id: input.teamId },
      select: { masterId: true },
    })
    if (!team) throw new Error("Time do perfil Radar não encontrado")

    // `Lead.leadCode` é `@unique` global. O código derivado do perfil só é
    // estável enquanto vale o par 1:1 perfil → lead; na divergência de
    // identidade o mesmo perfil promove um segundo lead, e reusar o código
    // levantaria P2002 e abortaria a transação — o respondente divergente
    // ficaria sem card nenhum. A semente da sessão mantém o código
    // determinístico (retry do mesmo gate gera o mesmo) sem colidir.
    const stableCode = input.leadCodeSeed
      ? createHash("sha1")
          .update(`${input.profile.id}:${input.leadCodeSeed}`)
          .digest("hex")
          .slice(0, 12)
          .toUpperCase()
      : input.profile.id.replaceAll("-", "").slice(0, 12).toUpperCase()
    const lead = await this.transaction.lead.create({
      data: {
        leadCode: `R${stableCode}`,
        managerId: team.masterId,
        teamId: input.teamId,
        status: LeadStatus.new_opportunity,
        name: input.profile.displayName,
        phone,
        email,
        assignedTo: form.assignedSdrId ?? undefined,
        originChannel: fromEmailCampaign ? "email_campaign" : "public_form",
        originMetadata: {
          source: "radar_public_form_gate",
          radarProfileId: input.profile.id,
          formId: input.formId,
          formPublicId: form.publicId,
          formName: form.name,
          ...(campaignId ? { campaignId } : {}),
          ...(emailLogId ? { emailLogId } : {}),
          // Indicação: a resposta veio pelo link do e-mail de outra pessoa. É
          // sinal comercial, e cabe no JSON que já existe — sem coluna nova.
          ...(input.referral ? { referral: { ...input.referral } } : {}),
        },
        createdBy: team.masterId,
        updatedBy: team.masterId,
        activities: {
          create: {
            type: ActivityType.note,
            body: "Lead criado pelo Radar a partir de formulário público",
            payload: {
              kind: "lead_creation",
              channel: "public_form",
              radarProfileId: input.profile.id,
            },
          },
        },
      },
      select: { id: true },
    })
    return { leadId: lead.id, created: true }
  }

  async linkLeadIdentity(input: {
    teamId: string
    radarProfileId: string
    leadId: string
    source: string
  }): Promise<void> {
    const existing = await this.transaction.radarIdentity.findFirst({
      where: { teamId: input.teamId, profileId: input.radarProfileId, type: "lead_id" },
      select: { id: true, normalizedValue: true, createdAt: true },
    })
    if (existing?.normalizedValue === input.leadId) return

    if (existing && isPendingLeadIdentity(existing.normalizedValue)) {
      // Reserva FRESCA = promoção manual em andamento. Apagá-la aqui faria a
      // promoção finalizar sobre uma linha que não existe mais (o `updateMany`
      // vira no-op), e o sync dela criaria um SEGUNDO `lead_id` no perfil —
      // dois vínculos de CRM e Lead duplicado. Recusar é o certo: a promoção
      // termina em segundos e o gate reprocessa.
      const ageMs = Date.now() - existing.createdAt.getTime()
      if (ageMs < PENDING_LEAD_IDENTITY_STALE_MS) {
        throw new Error("Perfil Radar tem promoção manual em andamento")
      }

      // Passada a janela, a reserva é órfã (a liberação é best-effort e pode
      // ter falhado). Assumir a linha evita o perfil ficar recusado para
      // sempre por causa de algo que nem lead é.
      await this.transaction.radarIdentity.delete({ where: { id: existing.id } })
    } else if (existing) {
      throw new Error("Perfil Radar já está vinculado a outro lead")
    }

    await this.transaction.radarIdentity.create({
      data: {
        teamId: input.teamId,
        profileId: input.radarProfileId,
        type: "lead_id",
        value: input.leadId,
        normalizedValue: input.leadId,
        source: input.source,
        isPrimary: false,
      },
    })
  }

  async appendGateEvent(input: {
    teamId: string
    radarProfileId: string
    eventType: "radar.crm_identity_conflict" | "radar.crm_lead_created" | "radar.crm_lead_attached"
    eventId: string
    metadata: Record<string, string | boolean | null>
  }): Promise<void> {
    const existing = await this.transaction.radarEvent.findFirst({
      where: {
        teamId: input.teamId,
        profileId: input.radarProfileId,
        eventType: input.eventType,
        sourceType: "public_form_lead_gate",
        sourceId: input.eventId,
      },
      select: { id: true },
    })
    if (existing) return

    await this.transaction.radarEvent.create({
      data: {
        teamId: input.teamId,
        profileId: input.radarProfileId,
        eventType: input.eventType,
        sourceType: "public_form_lead_gate",
        sourceId: input.eventId,
        occurredAt: new Date(),
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    })
  }

  async attachLeadToPendingSubmissions(input: {
    formId: string
    visitorSessionId: string
    leadId: string
    replaceLeadId?: string | null
  }): Promise<void> {
    await this.transaction.publicFormSubmission.updateMany({
      where: {
        formId: input.formId,
        visitorSessionId: input.visitorSessionId,
        // Sem `replaceLeadId` o filtro continua sendo "submissão sem lead". Com
        // ele (divergência de identidade), a submissão que uma resposta
        // anterior anexou ao lead do destinatário é puxada para o card novo —
        // senão a atividade de conclusão vai para o card errado e a próxima
        // revisão de identidade cria mais um lead de indicação.
        ...(input.replaceLeadId
          ? { OR: [{ leadId: null }, { leadId: input.replaceLeadId }] }
          : { leadId: null }),
      },
      data: { leadId: input.leadId },
    })

    // SPEC 40 E2 × modo radar (review #1051). O evento de progresso que move o
    // gate e o job da submissão vivem em filas diferentes, sem ordem garantida:
    // a submissão pode completar e emitir `lead_discarded` ANTES de o gate
    // anexar o lead. O `updateMany` acima conserta o vínculo, mas o evento de
    // descarte ficava lá — sessão convertida contada como descartada, o oposto
    // do que o funil promete.
    //
    // Compensação no mesmo `transaction` do gate: ou o lead é anexado e o
    // descarte some, ou nada acontece. Idempotente — rodar de novo não muda o
    // resultado, e sem descarte pendente é `deleteMany` de zero linhas.
    await this.transaction.publicFormMetricEvent.deleteMany({
      where: {
        formId: input.formId,
        visitorSessionId: input.visitorSessionId,
        eventType: "lead_discarded",
      },
    })
  }
}

export class RadarLeadGateUnitOfWork implements IRadarLeadGateUnitOfWork {
  constructor(private readonly database: PrismaClient = prisma) {}

  execute<T>(
    input: { teamId: string; radarProfileId: string },
    work: (transaction: RadarLeadGateTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.$transaction(
      async (transaction) => {
        const lockKey = `radar-form-lead-gate:${input.teamId}:${input.radarProfileId}`
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
        return work(new PrismaRadarLeadGateTransaction(transaction))
      },
      { timeout: 15_000 },
    )
  }
}

export const radarLeadGateUnitOfWork = new RadarLeadGateUnitOfWork()
