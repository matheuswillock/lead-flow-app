import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import { customerDataPlatformService } from "@/app/api/services/cdp/CustomerDataPlatformService"
import { isValidCdpFieldKey } from "@/lib/cdp/field-catalog"

export type EmailVariableType = "string" | "number"
export type EmailVariableValueSource = "STATIC" | "CDP"

export interface UpsertEmailVariableInput {
  key: string
  type?: EmailVariableType
  defaultValue?: string | null
  description?: string | null
  isActive?: boolean
  valueSource?: EmailVariableValueSource
  cdpFieldKey?: string | null
}

const variableSelect = {
  id: true,
  key: true,
  type: true,
  defaultValue: true,
  description: true,
  isActive: true,
  valueSource: true,
  cdpFieldKey: true,
} satisfies Prisma.EmailTeamVariableSelect

const KEY_RE = /^[a-zA-Z0-9_]+$/

function normalizeKey(key: string): string {
  return key.trim().replace(/[^a-zA-Z0-9_]/g, "")
}

function validateInput(input: UpsertEmailVariableInput): string | null {
  const key = normalizeKey(input.key ?? "")
  if (!key) return "A chave da variável é obrigatória (apenas letras, números e _)"
  if (!KEY_RE.test(key)) return "A chave deve conter apenas letras, números e _"
  if (input.type && input.type !== "string" && input.type !== "number") {
    return "Tipo inválido. Use 'string' ou 'number'"
  }

  const valueSource = input.valueSource ?? "STATIC"
  if (valueSource !== "STATIC" && valueSource !== "CDP") {
    return "Origem inválida. Use 'STATIC' ou 'CDP'"
  }

  if (valueSource === "CDP") {
    if (!input.cdpFieldKey?.trim()) {
      return "Selecione um campo da CDP para variáveis com origem CDP"
    }
    if (!isValidCdpFieldKey(input.cdpFieldKey)) {
      return "Campo da CDP inválido"
    }
  }

  if (valueSource === "STATIC" && input.cdpFieldKey) {
    return "Campos da CDP só são permitidos quando a origem é CDP"
  }

  return null
}

async function refreshCdpProfileData(ctx: TeamContext) {
  try {
    await customerDataPlatformService.syncProfileDataForTeam({
      teamId: ctx.teamId,
      ctx: {
        profileId: ctx.profileId,
        userTimezone: ctx.userTimezone,
        teamMember: {
          role: ctx.teamMember.role,
          functions: ctx.teamMember.functions,
        },
      },
    })
  } catch (error) {
    console.error("[EmailTeamVariablesUseCase][refreshCdpProfileData]", error)
  }
}

export class EmailTeamVariablesUseCase {
  async list(ctx: TeamContext): Promise<Output> {
    try {
      const variables = await prisma.emailTeamVariable.findMany({
        where: { teamId: ctx.teamId },
        select: variableSelect,
        orderBy: [{ key: "asc" }],
      })
      return new Output(true, [], [], variables)
    } catch (error) {
      console.error("[EmailTeamVariablesUseCase][list]", error)
      return new Output(false, [], ["Erro ao buscar variáveis globais"], null)
    }
  }

  /**
   * Returns a map of active static global variable keys to their default values.
   */
  async getDefaultsMap(ctx: TeamContext): Promise<Output> {
    try {
      const variables = await prisma.emailTeamVariable.findMany({
        where: {
          teamId: ctx.teamId,
          isActive: true,
          valueSource: "STATIC",
          defaultValue: { not: null },
        },
        select: { key: true, defaultValue: true },
      })
      const map = variables.reduce<Record<string, string>>((acc, v) => {
        if (v.defaultValue != null) acc[v.key] = v.defaultValue
        return acc
      }, {})
      return new Output(true, [], [], map)
    } catch (error) {
      console.error("[EmailTeamVariablesUseCase][getDefaultsMap]", error)
      return new Output(false, [], ["Erro ao buscar variáveis globais"], null)
    }
  }

  async create(input: UpsertEmailVariableInput, ctx: TeamContext): Promise<Output> {
    try {
      const validationError = validateInput(input)
      if (validationError) return new Output(false, [], [validationError], null)

      const key = normalizeKey(input.key)
      const valueSource = input.valueSource ?? "STATIC"
      const existing = await prisma.emailTeamVariable.findUnique({
        where: { teamId_key: { teamId: ctx.teamId, key } },
        select: { id: true },
      })
      if (existing) {
        return new Output(false, [], [`Já existe uma variável com a chave "${key}"`], null)
      }

      const variable = await prisma.emailTeamVariable.create({
        data: {
          teamId: ctx.teamId,
          key,
          type: input.type ?? "string",
          defaultValue: input.defaultValue?.trim() ? input.defaultValue.trim() : null,
          description: input.description?.trim() ? input.description.trim() : null,
          isActive: input.isActive ?? true,
          valueSource,
          cdpFieldKey: valueSource === "CDP" ? input.cdpFieldKey?.trim() ?? null : null,
        },
        select: variableSelect,
      })

      if (valueSource === "CDP") {
        await refreshCdpProfileData(ctx)
      }

      return new Output(true, ["Variável global criada com sucesso"], [], variable)
    } catch (error) {
      console.error("[EmailTeamVariablesUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar variável global"], null)
    }
  }

  async update(variableId: string, input: UpsertEmailVariableInput, ctx: TeamContext): Promise<Output> {
    try {
      const validationError = validateInput(input)
      if (validationError) return new Output(false, [], [validationError], null)

      const existing = await prisma.emailTeamVariable.findFirst({
        where: { id: variableId, teamId: ctx.teamId },
        select: { id: true },
      })
      if (!existing) {
        return new Output(false, [], ["Variável não encontrada"], null)
      }

      const key = normalizeKey(input.key)
      const valueSource = input.valueSource ?? "STATIC"
      const conflict = await prisma.emailTeamVariable.findFirst({
        where: { teamId: ctx.teamId, key, id: { not: variableId } },
        select: { id: true },
      })
      if (conflict) {
        return new Output(false, [], [`Já existe uma variável com a chave "${key}"`], null)
      }

      const variable = await prisma.emailTeamVariable.update({
        where: { id: variableId },
        data: {
          key,
          type: input.type ?? "string",
          defaultValue: input.defaultValue?.trim() ? input.defaultValue.trim() : null,
          description: input.description?.trim() ? input.description.trim() : null,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          valueSource,
          cdpFieldKey: valueSource === "CDP" ? input.cdpFieldKey?.trim() ?? null : null,
        },
        select: variableSelect,
      })

      await refreshCdpProfileData(ctx)

      return new Output(true, ["Variável global atualizada com sucesso"], [], variable)
    } catch (error) {
      console.error("[EmailTeamVariablesUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar variável global"], null)
    }
  }

  async delete(variableId: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailTeamVariable.findFirst({
        where: { id: variableId, teamId: ctx.teamId },
        select: { id: true, valueSource: true },
      })
      if (!existing) {
        return new Output(false, [], ["Variável não encontrada"], null)
      }

      await prisma.emailTeamVariable.delete({ where: { id: variableId } })

      if (existing.valueSource === "CDP") {
        await refreshCdpProfileData(ctx)
      }

      return new Output(true, ["Variável global removida com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailTeamVariablesUseCase][delete]", error)
      return new Output(false, [], ["Erro ao remover variável global"], null)
    }
  }
}
