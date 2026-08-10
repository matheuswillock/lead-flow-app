/**
 * One-off: recalcula totalSent de dispatches históricos a partir do EmailLog real (D10 / EMAIL_AUDIT §8.3).
 *
 * Casos conhecidos (por nome de campanha):
 * - Rede D'Or . 001 (MultiSkill) — esperado ~1.001 sent
 * - LISTA FRIA - BRUNO (parte 12/12) (Meu studio) — esperado ~795 sent
 * - 17.07 (MultiSkill) — esperado ~2.279 sent
 *
 * Uso:
 *   bun run scripts/reconcile-historical-dispatch-totals.ts              # dry-run (padrão)
 *   bun run scripts/reconcile-historical-dispatch-totals.ts --apply    # grava (requer autorização do owner)
 */
import { PrismaClient } from "@prisma/client";

const SUCCESS_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;

const KNOWN_CAMPAIGN_NAMES = [
  "Rede D'Or . 001",
  "LISTA FRIA - BRUNO (parte 12/12)",
  "17.07",
] as const;

const prisma = new PrismaClient();

type ReconcileCandidate = {
  dispatchId: string;
  campaignId: string;
  campaignName: string;
  teamName: string;
  currentTotalSent: number;
  actualSentCount: number;
  dispatchStatus: string;
};

async function findCandidates(): Promise<ReconcileCandidate[]> {
  const dispatches = await prisma.emailCampaignDispatch.findMany({
    where: {
      status: "failed",
      totalSent: 0,
      campaign: {
        name: { in: [...KNOWN_CAMPAIGN_NAMES] },
      },
    },
    select: {
      id: true,
      status: true,
      totalSent: true,
      campaignId: true,
      campaign: {
        select: {
          name: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  const candidates: ReconcileCandidate[] = [];

  for (const dispatch of dispatches) {
    const actualSentCount = await prisma.emailLog.count({
      where: {
        dispatchId: dispatch.id,
        status: { in: [...SUCCESS_STATUSES] },
      },
    });

    if (actualSentCount <= 0) continue;

    candidates.push({
      dispatchId: dispatch.id,
      campaignId: dispatch.campaignId,
      campaignName: dispatch.campaign.name,
      teamName: dispatch.campaign.team.name,
      currentTotalSent: dispatch.totalSent,
      actualSentCount,
      dispatchStatus: dispatch.status,
    });
  }

  return candidates;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "apply" : "dry-run";

  console.info(`[reconcile-historical-dispatch-totals] mode=${mode}`);

  const candidates = await findCandidates();

  if (candidates.length === 0) {
    console.info(
      "Nenhum dispatch candidato encontrado (failed + totalSent=0 + campanhas conhecidas + EmailLog com sucesso)."
    );
    return;
  }

  console.info(`Encontrados ${candidates.length} dispatch(es) para reconciliar:\n`);

  for (const row of candidates) {
    console.info({
      campaignName: row.campaignName,
      teamName: row.teamName,
      dispatchId: row.dispatchId,
      currentTotalSent: row.currentTotalSent,
      actualSentCount: row.actualSentCount,
      dispatchStatus: row.dispatchStatus,
    });

    if (apply) {
      await prisma.emailCampaignDispatch.update({
        where: { id: row.dispatchId },
        data: { totalSent: row.actualSentCount },
      });
      console.info(`  → totalSent atualizado para ${row.actualSentCount}`);
    } else {
      console.info(`  → dry-run: totalSent seria ${row.actualSentCount}`);
    }
  }

  if (!apply) {
    console.info(
      "\nDry-run concluído. Para aplicar em produção, rode com --apply somente após autorização explícita do owner."
    );
  }
}

main()
  .catch((error) => {
    console.error("[reconcile-historical-dispatch-totals]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
