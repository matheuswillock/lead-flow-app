import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import {
  parseRadarSegmentRules,
  type RadarSegmentRules,
  RADAR_SEGMENT_MAX_CONDITIONS,
} from "@/lib/radar/segment-dsl"
import type { Prisma } from "@prisma/client"

type CreateChildSegmentInput = {
  ctx: TeamAccess
  parentSegmentId: string
  name: string
  description?: string | null
  childRules: RadarSegmentRules
}

type CreateChildSegmentResult = {
  segmentId: string
  name: string
  parentName: string
  totalConditions: number
}

/**
 * D14: Cria segmento filho que herda as condições do pai (AND).
 * Valida limite de 10 condições após merge.
 */
export class CreateChildSegmentUseCase {
  /**
   * Mescla condições do pai com as do filho usando lógica AND.
   * Valida limite de 10 condições totais.
   */
  private mergeParentAndChildConditions(
    parentRules: RadarSegmentRules,
    childRules: RadarSegmentRules
  ): RadarSegmentRules {
    const mergedConditions = [...parentRules.conditions, ...childRules.conditions]

    if (mergedConditions.length > RADAR_SEGMENT_MAX_CONDITIONS) {
      throw new Error(
        `Limite excedido: total de ${mergedConditions.length} condições ` +
          `(${parentRules.conditions.length} do pai + ${childRules.conditions.length} novas, ` +
          `máximo ${RADAR_SEGMENT_MAX_CONDITIONS})`
      )
    }

    return {
      match: "all",
      conditions: mergedConditions,
    }
  }

  async execute(input: CreateChildSegmentInput): Promise<Output<CreateChildSegmentResult>> {
    try {
      const parentSegment = await teamRadarSegmentRepository.findById(
        input.ctx.teamId,
        input.parentSegmentId
      )

      if (!parentSegment) {
        return new Output(false, [], ["Segmento pai não encontrado"], null)
      }

      if (!parentSegment.isActive) {
        return new Output(false, [], ["Segmento pai está inativo"], null)
      }

      let parentRules: RadarSegmentRules
      try {
        parentRules = parseRadarSegmentRules(parentSegment.rulesJson)
      } catch {
        return new Output(false, [], ["Condições do segmento pai são inválidas"], null)
      }

      let childRulesParsed: RadarSegmentRules
      try {
        childRulesParsed = parseRadarSegmentRules(input.childRules)
      } catch (validationError) {
        return new Output(
          false,
          [],
          [validationError instanceof Error ? validationError.message : "Condições do filho inválidas"],
          null
        )
      }

      let mergedRules: RadarSegmentRules
      try {
        mergedRules = this.mergeParentAndChildConditions(parentRules, childRulesParsed)
      } catch (mergeError) {
        return new Output(
          false,
          [],
          [mergeError instanceof Error ? mergeError.message : "Erro ao mesclar condições"],
          null
        )
      }

      const segment = await teamRadarSegmentRepository.create({
        team: { connect: { id: input.ctx.teamId } },
        creator: { connect: { id: input.ctx.profileId } },
        name: input.name.trim(),
        description: input.description?.trim() || null,
        rulesJson: mergedRules as unknown as Prisma.InputJsonValue,
        sourceType: "child",
        parent: { connect: { id: input.parentSegmentId } },
      })

      return new Output(
        true,
        ["Segmento filho criado com sucesso"],
        [],
        {
          segmentId: segment.id,
          name: segment.name,
          parentName: parentSegment.name,
          totalConditions: mergedRules.conditions.length,
        }
      )
    } catch (error) {
      console.error("[CreateChildSegmentUseCase][execute]", error)
      if (error instanceof Error && error.message.includes("Já existe um segmento com esse nome")) {
        return new Output(false, [], [error.message], null)
      }
      return new Output(false, [], ["Erro ao criar segmento filho"], null)
    }
  }
}

export const createChildSegmentUseCase = new CreateChildSegmentUseCase()
