/**
 * Reconcilia audiências de campanhas pendentes removendo destinatários suprimidos
 * (bounce, descadastro ou reclamação) e recalculando totalRecipients.
 *
 * Uso:
 *   bun scripts/reconcile-campaign-audiences.ts --teamId=<uuid>
 *   bun scripts/reconcile-campaign-audiences.ts --all-teams
 */

import { prisma } from "@/app/api/infra/data/prisma"
import { emailCampaignAudiencePruningService } from "@/app/api/services/emailCampaignAudience/EmailCampaignAudiencePruningService"

function readArgValues(name: string): string[] {
  const prefix = `--${name}=`
  return process.argv.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length))
}

async function main() {
  const teamIds = readArgValues("teamId")
  const allTeams = process.argv.includes("--all-teams")

  if (!allTeams && teamIds.length === 0) {
    console.error(
      "Uso: bun scripts/reconcile-campaign-audiences.ts --teamId=<uuid> [--teamId=<uuid>...] | --all-teams"
    )
    process.exitCode = 1
    return
  }

  const targets = allTeams
    ? (
        await prisma.emailCampaign.findMany({
          where: {
            status: { in: ["draft", "scheduled", "partially_sent"] },
            subCampaigns: { none: {} },
          },
          select: { teamId: true },
          distinct: ["teamId"],
        })
      ).map((row) => row.teamId)
    : teamIds

  for (const teamId of targets) {
    const result = await emailCampaignAudiencePruningService.reconcileTeamCampaigns(teamId)
    console.info("[reconcile-campaign-audiences] ok", {
      teamId,
      prunedCampaignIds: result.prunedCampaignIds,
      canceledCampaignIds: result.canceledCampaignIds,
    })
  }
}

main()
  .catch((error) => {
    console.error("[reconcile-campaign-audiences]", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
