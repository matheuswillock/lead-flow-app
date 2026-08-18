import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { emailCampaignRepository } from "@/app/api/infra/data/repositories/emailCampaign/EmailCampaignRepository"
import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import { extractCampaignEventConditions } from "@/lib/radar/campaign-segment-preset"
import { mergeHierarchicalSegmentRules } from "@/lib/radar/merge-hierarchical-segment-rules"
import {
  radarSegmentAdditionalRulesSchema,
  type RadarSegmentAdditionalRules,
  type RadarSegmentRules,
} from "@/lib/radar/segment-dsl"
import { Prisma } from "@prisma/client"

type CreateFromCampaignInput = {
  ctx: TeamAccess
  campaignId: string
  name: string
  description?: string | null
  additionalRules?: RadarSegmentAdditionalRules
}

/**
 * D14: Cria segmento a partir de campanha de e-mail, extraindo condições
 * de evento (form.started sem form.completed) e mesclando com
 * condições adicionais fornecidas pelo usuário.
 */
export class CreateSegmentFromCampaignUseCase {
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

      const campaignConditions = extractCampaignEventConditions(campaign.id, campaign.sentAt)

      let mergedRules: RadarSegmentRules
      try {
        if (input.additionalRules) {
          radarSegmentAdditionalRulesSchema.parse(input.additionalRules)
        }
        mergedRules = mergeHierarchicalSegmentRules(campaignConditions, input.additionalRules)
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return new Output(false, [], ["Já existe um segmento com esse nome"], null)
      }
      if (error instanceof Error && error.message.includes("Já existe um segmento com esse nome")) {
        return new Output(false, [], [error.message], null)
      }
      return new Output(false, [], ["Erro ao criar segmento da campanha"], null)
    }
  }
}

export const createSegmentFromCampaignUseCase = new CreateSegmentFromCampaignUseCase()
