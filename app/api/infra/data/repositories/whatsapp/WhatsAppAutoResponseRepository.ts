import {
  Prisma,
  type WhatsAppAutoResponseMatchMode,
  type WhatsAppAutoResponseRuleType,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export type WhatsAppAutoResponseRuleSelect = {
  id: string
  configId: string
  type: WhatsAppAutoResponseRuleType
  replyMessage: string
  triggerKeywords: string[]
  matchMode: WhatsAppAutoResponseMatchMode
  offHoursSchedule: Prisma.JsonValue | null
  isActive: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
}

const RULE_SELECT = {
  id: true,
  configId: true,
  type: true,
  replyMessage: true,
  triggerKeywords: true,
  matchMode: true,
  offHoursSchedule: true,
  isActive: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
} as const

export class WhatsAppAutoResponseRepository {
  async listActiveRulesByConfigId(configId: string): Promise<WhatsAppAutoResponseRuleSelect[]> {
    return prisma.whatsAppAutoResponseRule.findMany({
      where: { configId, isActive: true },
      select: RULE_SELECT,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    })
  }

  async listRulesByConfigId(configId: string): Promise<WhatsAppAutoResponseRuleSelect[]> {
    return prisma.whatsAppAutoResponseRule.findMany({
      where: { configId },
      select: RULE_SELECT,
      orderBy: [{ type: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    })
  }

  async findRuleById(ruleId: string): Promise<WhatsAppAutoResponseRuleSelect | null> {
    return prisma.whatsAppAutoResponseRule.findUnique({
      where: { id: ruleId },
      select: RULE_SELECT,
    })
  }

  async findRuleByIdForConfig(
    ruleId: string,
    configId: string
  ): Promise<WhatsAppAutoResponseRuleSelect | null> {
    return prisma.whatsAppAutoResponseRule.findFirst({
      where: { id: ruleId, configId },
      select: RULE_SELECT,
    })
  }

  async createRule(
    data: Prisma.WhatsAppAutoResponseRuleCreateInput
  ): Promise<WhatsAppAutoResponseRuleSelect> {
    return prisma.whatsAppAutoResponseRule.create({
      data,
      select: RULE_SELECT,
    })
  }

  async updateRule(
    ruleId: string,
    data: Prisma.WhatsAppAutoResponseRuleUpdateInput
  ): Promise<WhatsAppAutoResponseRuleSelect> {
    return prisma.whatsAppAutoResponseRule.update({
      where: { id: ruleId },
      data,
      select: RULE_SELECT,
    })
  }

  async deleteRule(ruleId: string): Promise<void> {
    await prisma.whatsAppAutoResponseRule.delete({ where: { id: ruleId } })
  }

  async hasRecentLog(params: {
    conversationId: string
    ruleType: WhatsAppAutoResponseRuleType
    since: Date
  }): Promise<boolean> {
    const count = await prisma.whatsAppAutoResponseLog.count({
      where: {
        conversationId: params.conversationId,
        ruleType: params.ruleType,
        createdAt: { gte: params.since },
      },
    })
    return count > 0
  }

  async createLog(data: Prisma.WhatsAppAutoResponseLogCreateInput): Promise<{ id: string }> {
    const log = await prisma.whatsAppAutoResponseLog.create({
      data,
      select: { id: true },
    })
    return log
  }

  async updateLogOutbound(logId: string, outboundMessageId: string | undefined): Promise<void> {
    if (!outboundMessageId) return
    await prisma.whatsAppAutoResponseLog.update({
      where: { id: logId },
      data: { outboundMessageId },
    })
  }

  async seedDefaultRules(configId: string): Promise<void> {
    const existing = await prisma.whatsAppAutoResponseRule.count({ where: { configId } })
    if (existing > 0) return

    await prisma.whatsAppAutoResponseRule.createMany({
      data: [
        {
          configId,
          type: "WELCOME",
          replyMessage: "Olá! Obrigado por entrar em contato. Em breve um de nossos corretores irá atendê-lo.",
          isActive: false,
          priority: 10,
        },
        {
          configId,
          type: "OFF_HOURS",
          replyMessage: "No momento estamos fora do horário de atendimento. Retornaremos em breve.",
          isActive: false,
          priority: 20,
          offHoursSchedule: {
            timezone: "America/Sao_Paulo",
            days: {
              mon: [{ start: "09:00", end: "18:00" }],
              tue: [{ start: "09:00", end: "18:00" }],
              wed: [{ start: "09:00", end: "18:00" }],
              thu: [{ start: "09:00", end: "18:00" }],
              fri: [{ start: "09:00", end: "18:00" }],
            },
          },
        },
        {
          configId,
          type: "KEYWORD",
          replyMessage: "",
          triggerKeywords: [],
          matchMode: "CONTAINS",
          isActive: false,
          priority: 30,
        },
      ],
    })
  }
}

export const whatsAppAutoResponseRepository = new WhatsAppAutoResponseRepository()
