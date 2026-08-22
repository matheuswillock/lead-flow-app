/**
 * Retoma dispatches de campanha presos em `sending` publicando um wake com
 * idempotency key única, driblando as chaves já consumidas na janela de dedupe
 * de 24h da Vercel Queue.
 *
 * PRÉ-REQUISITO: as correções de idempotency key (`batchOffset` no `continue`,
 * `wakeBucket` nos reasons de cron) precisam já estar EM PRODUÇÃO. Rodar antes
 * disso faz cada dispatch drenar um único lote e travar de novo — desperdiça a
 * retomada sem resolver nada.
 *
 * Uso:
 *   bun run scripts/recover-stuck-campaign-dispatches.ts            # dry-run (padrão)
 *   bun run scripts/recover-stuck-campaign-dispatches.ts --apply    # publica (requer autorização do owner)
 *   bun run scripts/recover-stuck-campaign-dispatches.ts --dispatch=<uuid> --apply
 *
 * `--apply` dispara envio real de e-mail. Diagnostique antes com
 * `scripts/diagnose-stuck-campaign-dispatches.ts`.
 */
import { PrismaClient } from "@prisma/client";
import {
  publishEmailCampaignDispatchOverflowWake,
  publishEmailCampaignDispatchWake,
} from "../lib/queues/email-campaign-dispatch";
import { resolveEmailCampaignDispatchWakeQueue } from "../lib/email/dispatch-wake-queue";

const prisma = new PrismaClient();

type StuckDispatch = {
  id: string;
  campaignName: string;
  totalRecipients: number;
  materializedCount: number;
  queuedCount: number;
  materializeSourceOffset: number;
  createdAt: Date;
};

function parseArgs(): { apply: boolean; dispatchId: string | null } {
  const dispatchArg = process.argv.find((arg) => arg.startsWith("--dispatch="));
  return {
    apply: process.argv.includes("--apply"),
    dispatchId: dispatchArg ? dispatchArg.slice("--dispatch=".length) : null,
  };
}

async function findStuckDispatches(dispatchId: string | null): Promise<StuckDispatch[]> {
  const candidates = await prisma.emailCampaignDispatch.findMany({
    where: {
      status: "sending",
      campaign: { status: "sending" },
      ...(dispatchId ? { id: dispatchId } : {}),
    },
    select: {
      id: true,
      totalRecipients: true,
      materializeSourceOffset: true,
      createdAt: true,
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const stuck: StuckDispatch[] = [];

  for (const candidate of candidates) {
    const [materializedCount, queuedCount] = await Promise.all([
      prisma.emailLog.count({ where: { dispatchId: candidate.id } }),
      prisma.emailLog.count({ where: { dispatchId: candidate.id, status: "queued" } }),
    ]);

    // Preso = nada na fila para enviar, mas ainda falta audiência a materializar.
    if (queuedCount > 0 || materializedCount >= candidate.totalRecipients) continue;

    stuck.push({
      id: candidate.id,
      campaignName: candidate.campaign.name,
      totalRecipients: candidate.totalRecipients,
      materializedCount,
      queuedCount,
      materializeSourceOffset: candidate.materializeSourceOffset,
      createdAt: candidate.createdAt,
    });
  }

  return stuck;
}

async function republishWake(dispatch: StuckDispatch): Promise<string> {
  // Chave manual única: as chaves `cron-start`/`cron-reclaim` desses dispatches
  // já foram consumidas e continuariam deduplicando até a janela de 24h expirar.
  const idempotencyKey = `${dispatch.id}:manual-recovery:${Date.now()}`;
  const queue = resolveEmailCampaignDispatchWakeQueue({ createdAt: dispatch.createdAt });
  const publish =
    queue === "overflow"
      ? publishEmailCampaignDispatchOverflowWake
      : publishEmailCampaignDispatchWake;

  await publish({ dispatchId: dispatch.id, reason: "cron-reclaim" }, { idempotencyKey });
  return `${queue} (${idempotencyKey})`;
}

async function main(): Promise<void> {
  const { apply, dispatchId } = parseArgs();
  const stuck = await findStuckDispatches(dispatchId);

  console.info(`Modo: ${apply ? "APPLY (publica na fila)" : "DRY-RUN"}`);
  console.info(`Dispatches presos encontrados: ${stuck.length}\n`);

  if (stuck.length === 0) return;

  for (const dispatch of stuck) {
    const pending = dispatch.totalRecipients - dispatch.materializedCount;
    console.info(
      `${dispatch.campaignName} (${dispatch.id.slice(0, 8)}) — materializado ${dispatch.materializedCount}/${dispatch.totalRecipients}, faltam ${pending}, offset ${dispatch.materializeSourceOffset}`
    );

    if (!apply) continue;

    try {
      const target = await republishWake(dispatch);
      console.info(`  -> wake publicado em ${target}`);
    } catch (error) {
      console.error(`  -> FALHOU ao publicar wake para ${dispatch.id}`, error);
      process.exitCode = 1;
    }
  }

  if (!apply) {
    console.info(
      "\nDry-run: nada publicado. Confirme que as correções de idempotency key já estão em produção e rode de novo com --apply."
    );
  }
}

main()
  .catch((error) => {
    console.error("[recover-stuck-campaign-dispatches]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
