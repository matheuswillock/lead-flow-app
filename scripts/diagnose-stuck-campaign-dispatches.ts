/**
 * Diagnóstico SOMENTE LEITURA de dispatches de campanha presos em `sending`.
 *
 * Nenhuma escrita: só SELECT/count. Não existe flag `--apply` de propósito —
 * para retomar os dispatches use `scripts/recover-stuck-campaign-dispatches.ts`.
 *
 * Responde à pergunta que o `updatedAt` sozinho não responde: a linha do
 * dispatch está sendo tocada por **progresso de materialização** ou apenas
 * pelos contadores incrementados a cada webhook do Resend
 * (`EmailLogRepository.applyWebhookEvent` faz `emailCampaignDispatch.update()`
 * em delivered/opened/clicked/bounced/complained)?
 *
 * Uso:
 *   bun run scripts/diagnose-stuck-campaign-dispatches.ts
 *   bun run scripts/diagnose-stuck-campaign-dispatches.ts --dispatch=<uuid>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Acima disto, o gap entre último log criado e updatedAt indica ausência de materialização. */
const STALE_MATERIALIZATION_GAP_MS = 60 * 60 * 1000;
/** Abaixo disto, o último log criado é contemporâneo do updatedAt — houve materialização recente. */
const FRESH_MATERIALIZATION_GAP_MS = 5 * 60 * 1000;

type LogBatchRow = { bucket: Date; total: bigint };

type DispatchDiagnosis = {
  dispatchId: string;
  campaignName: string;
  totalRecipients: number;
  materializedCount: number;
  queuedCount: number;
  materializeSourceOffset: number;
  updatedAt: Date;
  lastLogCreatedAt: Date | null;
  lastWebhookAt: Date | null;
  batches: LogBatchRow[];
};

function parseDispatchFilter(): string | null {
  const raw = process.argv.find((arg) => arg.startsWith("--dispatch="));
  return raw ? raw.slice("--dispatch=".length) : null;
}

function minutesBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60_000);
}

async function collectDiagnosis(dispatchFilter: string | null): Promise<DispatchDiagnosis[]> {
  const dispatches = await prisma.emailCampaignDispatch.findMany({
    where: {
      status: "sending",
      campaign: { status: "sending" },
      ...(dispatchFilter ? { id: dispatchFilter } : {}),
    },
    select: {
      id: true,
      totalRecipients: true,
      materializeSourceOffset: true,
      updatedAt: true,
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const diagnoses: DispatchDiagnosis[] = [];

  for (const dispatch of dispatches) {
    const [materializedCount, queuedCount, timestamps, batches] = await Promise.all([
      prisma.emailLog.count({ where: { dispatchId: dispatch.id } }),
      prisma.emailLog.count({ where: { dispatchId: dispatch.id, status: "queued" } }),
      prisma.emailLog.aggregate({
        where: { dispatchId: dispatch.id },
        _max: { createdAt: true, deliveredAt: true, openedAt: true, clickedAt: true },
      }),
      // Histograma por minuto: cada pico é um lote materializado.
      prisma.$queryRaw<LogBatchRow[]>`
        SELECT date_trunc('minute', "createdAt") AS bucket, count(*) AS total
        FROM "public"."corretor_studio_email_logs"
        WHERE "dispatchId" = ${dispatch.id}::uuid
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    const webhookTimestamps = [
      timestamps._max.deliveredAt,
      timestamps._max.openedAt,
      timestamps._max.clickedAt,
    ].filter((value): value is Date => value != null);

    diagnoses.push({
      dispatchId: dispatch.id,
      campaignName: dispatch.campaign.name,
      totalRecipients: dispatch.totalRecipients,
      materializedCount,
      queuedCount,
      materializeSourceOffset: dispatch.materializeSourceOffset,
      updatedAt: dispatch.updatedAt,
      lastLogCreatedAt: timestamps._max.createdAt,
      lastWebhookAt: webhookTimestamps.length
        ? new Date(Math.max(...webhookTimestamps.map((value) => value.getTime())))
        : null,
      batches,
    });
  }

  return diagnoses;
}

function reportDispatch(diagnosis: DispatchDiagnosis): "stale" | "fresh" | "inconclusive" {
  console.info(`\n--- ${diagnosis.campaignName} (${diagnosis.dispatchId.slice(0, 8)})`);
  console.info(
    `    materializado ${diagnosis.materializedCount}/${diagnosis.totalRecipients} | queued ${diagnosis.queuedCount} | offset ${diagnosis.materializeSourceOffset}`
  );
  console.info(`    dispatch.updatedAt   ${diagnosis.updatedAt.toISOString()}`);

  for (const batch of diagnosis.batches) {
    console.info(`    lote de logs @ ${batch.bucket.toISOString()}  n=${batch.total}`);
  }

  if (!diagnosis.lastLogCreatedAt) {
    console.info("    >> nenhum log materializado ainda — inconclusivo");
    return "inconclusive";
  }

  const materializationGapMs =
    diagnosis.updatedAt.getTime() - diagnosis.lastLogCreatedAt.getTime();
  console.info(
    `    último log criado    ${diagnosis.lastLogCreatedAt.toISOString()} (${minutesBetween(diagnosis.updatedAt, diagnosis.lastLogCreatedAt)} min antes do updatedAt)`
  );

  if (diagnosis.lastWebhookAt) {
    console.info(
      `    último webhook       ${diagnosis.lastWebhookAt.toISOString()} (${minutesBetween(diagnosis.updatedAt, diagnosis.lastWebhookAt)} min antes do updatedAt)`
    );
  } else {
    console.info("    último webhook       nenhum");
  }

  if (materializationGapMs > STALE_MATERIALIZATION_GAP_MS) {
    console.info("    >> SEM materialização recente: updatedAt vem de outra escrita (webhook)");
    return "stale";
  }
  if (materializationGapMs < FRESH_MATERIALIZATION_GAP_MS) {
    console.info("    >> materialização RECENTE: o dispatch está progredindo de fato");
    return "fresh";
  }
  console.info("    >> zona cinzenta entre 5 e 60 min — inconclusivo");
  return "inconclusive";
}

async function reportCronExecutions(): Promise<void> {
  const executions = await prisma.backofficeCronExecution.findMany({
    where: { cronKey: "dispatch-scheduled" },
    orderBy: { startedAt: "desc" },
    take: 15,
    select: { startedAt: true, status: true, durationMs: true, errorSummary: true },
  });

  console.info("\n\n### Últimas execuções do cron dispatch-scheduled\n");
  for (const execution of executions) {
    console.info(
      `${execution.startedAt.toISOString()}  status=${execution.status}  duracao=${execution.durationMs ?? "-"}ms  erro=${execution.errorSummary?.slice(0, 120) ?? "-"}`
    );
  }
}

async function main(): Promise<void> {
  const dispatchFilter = parseDispatchFilter();
  const diagnoses = await collectDiagnosis(dispatchFilter);

  console.info("### Dispatches presos em sending\n");
  if (diagnoses.length === 0) {
    console.info("Nenhum dispatch preso encontrado.");
    await reportCronExecutions();
    return;
  }

  const verdicts = diagnoses.map(reportDispatch);
  const staleCount = verdicts.filter((verdict) => verdict === "stale").length;
  const freshCount = verdicts.filter((verdict) => verdict === "fresh").length;

  await reportCronExecutions();

  console.info("\n\n### Veredito\n");
  console.info(`Dispatches analisados: ${diagnoses.length}`);
  console.info(`  sem materialização recente (>60 min): ${staleCount}`);
  console.info(`  com materialização recente (<5 min):  ${freshCount}`);
  console.info(`  inconclusivos:                        ${verdicts.length - staleCount - freshCount}`);

  if (staleCount > freshCount) {
    console.info(
      "\nCONFIRMA a hipótese: o updatedAt recente vem dos contadores de webhook, não de progresso."
    );
  } else if (freshCount > 0) {
    console.info(
      "\nREFUTA a hipótese: há materialização recente de verdade — revisar o diagnóstico antes de corrigir as chaves."
    );
  } else {
    console.info("\nINCONCLUSIVO: nenhum dispatch caiu claramente de um dos lados.");
  }
}

main()
  .catch((error) => {
    console.error("[diagnose-stuck-campaign-dispatches]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
