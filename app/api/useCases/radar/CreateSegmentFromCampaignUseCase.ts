import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { emailCampaignRepository } from "@/app/api/infra/data/repositories/emailCampaign/EmailCampaignRepository"
import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import {
  parseRadarSegmentRules,
  type RadarSegmentRules,
  type RadarSegmentCondition,
  RADAR_SEGMENT_MAX_CONDITIONS,
} from "@/lib/radar/segment-dsl"
import type { Prisma } from "@prisma/client"

type CreateFromCampaignInput = {
  ctx: TeamAccess
  campaignId: string
  name: string
  description?: string | null
  additionalRules?: RadarSegmentRules
}

/**
 * D14: Cria segmento a partir de campanha de e-mail, extraindo condições
 * de evento (opened, clicked) automaticamente e mesclando com condições
 * adicionais fornecidas pelo usuário.
 */
export class CreateSegmentFromCampaignUseCase {
  /**
   * Extrai condições de evento da campanha (opened/clicked nos últimos N dias).
   * Retorna array vazio se a campanha não tiver eventos rastreáveis.
   */
  private extractCampaignEventConditions(
    campaignId: string,
    sentAt: Date | null
  ): RadarSegmentCondition[] {
    if (!sentAt) return []

    const daysSinceSent = Math.ceil((Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24))
    const windowDays = Math.max(30, daysSinceSent + 7)

    return [
      {
        kind: "event",
        eventType: "email.opened",
        occurrence: "occurred",
        windowDays,
        campaignId,
      },
      {
        kind: "event",
        eventType: "email.clicked",
        occurrence: "occurred",
        windowDays,
        campaignId,
      },
    ]
  }

  /**
   * Mescla condições da campanha com condições adicionais do usuário.
   * Valida limite de 10 condições totais.
   */
  private mergeConditions(
    campaignConditions: RadarSegmentCondition[],
    additionalRules: RadarSegmentRules | undefined
  ): RadarSegmentRules {
    const mergedConditions = [...campaignConditions]

    if (additionalRules) {
      mergedConditions.push(...additionalRules.conditions)
    }

    if (mergedConditions.length > RADAR_SEGMENT_MAX_CONDITIONS) {
      throw new Error(
        `Limite excedido: total de ${mergedConditions.length} condições (máximo ${RADAR_SEGMENT_MAX_CONDITIONS})`
      )
    }

    return {
      match: "all",
      conditions: mergedConditions,
    }
  }

  async execute(input: CreateFromCampaignInput): Promise<Output> {
    try {
      const campaign = await emailCampaignRepository.findForSegmentGeneration(
        input.ctx.teamId,
        input.campaignId
      )

      if (!campaign) {
        return new Output(false, [], ["Campanha não encontrada"], null)
      }

      if (campaign.status !== "sent" && campaign.status !== "partially_sent") {
        return new Output(
          false,
          [],
          ["Apenas campanhas enviadas podem gerar segmentos automaticamente"],
          null
        )
      }

      const campaignConditions = this.extractCampaignEventConditions(campaign.id, campaign.sentAt)

      let mergedRules: RadarSegmentRules
      try {
        if (input.additionalRules) {
          parseRadarSegmentRules(input.additionalRules)
        }
        mergedRules = this.mergeConditions(campaignConditions, input.additionalRules)
      } catch (validationError) {
        return new Output(
          false,
          [],
          [validationError instanceof Error ? validationError.message : "Condições inválidas"],
          null
        )
      }

      const segment = await teamRadarSegmentRepository.create({
        team: { connect: { id: input.ctx.teamId } },
        creator: { connect: { id: input.ctx.profileId } },
        name: input.name.trim(),
        description: input.description?.trim() || null,
        rulesJson: mergedRules as unknown as Prisma.InputJsonValue,
        sourceType: "campaign",
        sourceCampaign: { connect: { id: input.campaignId } },
      })

      return new Output(
        true,
        ["Segmento criado com sucesso a partir da campanha"],
        [],
        {
          segmentId: segment.id,
          name: segment.name,
          totalConditions: mergedRules.conditions.length,
        }
      )
    } catch (error) {
      console.error("[CreateSegmentFromCampaignUseCase][execute]", error)
      if (error instanceof Error && error.message.includes("Já existe um segmento com esse nome")) {
        return new Output(false, [], [error.message], null)
      }
      return new Output(false, [], ["Erro ao criar segmento da campanha"], null)
    }
  }
}

export const createSegmentFromCampaignUseCase = new CreateSegmentFromCampaignUseCase()
