import { prisma } from "@/app/api/infra/data/prisma"

/**
 * Expande um campaignId para incluir sub-campanhas quando o id for de um pai.
 * Logs/analytics de campanhas particionadas ficam no id dos filhos.
 */
export async function resolveCampaignIdsIncludingSubs(
  teamId: string,
  campaignId: string
): Promise<string[]> {
  const children = await prisma.emailCampaign.findMany({
    where: { teamId, parentCampaignId: campaignId },
    select: { id: true },
  })

  if (children.length === 0) return [campaignId]
  return [campaignId, ...children.map((child) => child.id)]
}
