import { prisma } from "@/app/api/infra/data/prisma"

/**
 * Client mínimo para a expansão — aceita `PrismaClient`, transaction client ou
 * o client injetado de um repositório, mantendo a consulta no mesmo contexto
 * de banco do chamador.
 */
export type ResolveCampaignQueryClient = {
  emailCampaign: {
    findMany(args: {
      where: { teamId: string; parentCampaignId: string }
      select: { id: true }
    }): Promise<Array<{ id: string }>>
  }
}

/**
 * Expande um campaignId para incluir sub-campanhas quando o id for de um pai.
 * Logs/analytics de campanhas particionadas ficam no id dos filhos.
 */
export async function resolveCampaignIdsIncludingSubs(
  teamId: string,
  campaignId: string,
  db: ResolveCampaignQueryClient = prisma
): Promise<string[]> {
  const children = await db.emailCampaign.findMany({
    where: { teamId, parentCampaignId: campaignId },
    select: { id: true },
  })

  if (children.length === 0) return [campaignId]
  return [campaignId, ...children.map((child) => child.id)]
}
