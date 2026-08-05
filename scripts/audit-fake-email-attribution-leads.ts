import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Diagnóstico read-only (nenhuma escrita) para leads criados pelo
 * ResolveEmailCampaignFormAttributionUseCase a partir de um simples
 * `form_viewed` (carregamento de página / prefetch de scanner de e-mail),
 * sem nenhuma PublicFormSubmission real correspondente.
 *
 * Critério: originMetadata.attribution === "email_campaign" E nenhuma
 * linha em PublicFormSubmission aponta para esse leadId.
 *
 * Janela de data (opcional, alinhada ao cleanup E6):
 *   --day YYYY-MM-DD | --from / --to | env FAKE_EMAIL_ATTRIBUTION_FROM/TO
 *   Sem flags: lista todos os afetados (comportamento original).
 *
 * Uso:
 *   bun run audit:fake-email-attribution-leads
 *   bun run audit:fake-email-attribution-leads -- --day 2026-08-05
 *
 * Cleanup (dry-run): bun run cleanup:fake-email-attribution-leads
 */

const DEFAULT_INCIDENT_DAY = "2026-08-05";

function parseDayArg(value: string, flagName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${flagName} inválido: esperado YYYY-MM-DD, recebido "${value}"`);
  }
  return value;
}

function utcDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function utcNextDay(day: string): Date {
  const start = utcDayStart(day);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function resolveOptionalDateWindow(args: string[]): {
  fromInclusive: Date;
  toExclusive: Date;
  fromDay: string;
  toDay: string;
} | null {
  const dayIdx = args.indexOf("--day");
  const fromIdx = args.indexOf("--from");
  const toIdx = args.indexOf("--to");
  const envFrom = process.env.FAKE_EMAIL_ATTRIBUTION_FROM?.trim();
  const envTo = process.env.FAKE_EMAIL_ATTRIBUTION_TO?.trim();

  const hasCli = dayIdx !== -1 || fromIdx !== -1 || toIdx !== -1;
  const hasEnv = Boolean(envFrom || envTo);

  if (!hasCli && !hasEnv) {
    return null;
  }

  let fromDay = envFrom || DEFAULT_INCIDENT_DAY;
  let toDay = envTo || fromDay;

  if (dayIdx !== -1) {
    const raw = args[dayIdx + 1];
    if (!raw) throw new Error("--day requer YYYY-MM-DD");
    fromDay = parseDayArg(raw, "--day");
    toDay = fromDay;
  }

  if (fromIdx !== -1) {
    const raw = args[fromIdx + 1];
    if (!raw) throw new Error("--from requer YYYY-MM-DD");
    fromDay = parseDayArg(raw, "--from");
  }

  if (toIdx !== -1) {
    const raw = args[toIdx + 1];
    if (!raw) throw new Error("--to requer YYYY-MM-DD");
    toDay = parseDayArg(raw, "--to");
  }

  const fromInclusive = utcDayStart(fromDay);
  const toExclusive = utcNextDay(toDay);

  if (fromInclusive >= toExclusive) {
    throw new Error(`Janela inválida: from=${fromDay} to=${toDay}`);
  }

  return { fromInclusive, toExclusive, fromDay, toDay };
}

/** Critério compartilhado com cleanup-fake-email-attribution-leads.ts */
function buildWhere(window: {
  fromInclusive: Date;
  toExclusive: Date;
} | null): Prisma.LeadWhereInput {
  return {
    originMetadata: { path: ["attribution"], equals: "email_campaign" },
    publicFormSubmissions: { none: {} },
    ...(window
      ? {
          createdAt: {
            gte: window.fromInclusive,
            lt: window.toExclusive,
          },
        }
      : {}),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const window = resolveOptionalDateWindow(args);
  const where = buildWhere(window);

  if (window) {
    console.info(
      `[audit-fake-email-attribution-leads] filtro UTC ${window.fromDay}..${window.toDay} (gte ${window.fromInclusive.toISOString()} lt ${window.toExclusive.toISOString()})`,
    );
  } else {
    console.info(
      "[audit-fake-email-attribution-leads] sem filtro de data (todos os afetados)",
    );
  }

  const affected = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      statusEnteredAt: true,
      teamId: true,
      team: { select: { name: true } },
      originMetadata: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.info(`[audit-fake-email-attribution-leads] ${affected.length} leads afetados encontrados`);

  const byTeam = new Map<string, number>();
  for (const lead of affected) {
    const teamName = lead.team?.name ?? lead.teamId ?? "—";
    byTeam.set(teamName, (byTeam.get(teamName) ?? 0) + 1);
  }

  console.info("\nPor time:");
  for (const [teamName, count] of [...byTeam.entries()].sort((a, b) => b[1] - a[1])) {
    console.info(`  ${teamName}: ${count}`);
  }

  console.info("\nDetalhe:");
  console.info("id,teamName,name,email,phone,status,createdAt,campaignId,emailLogId");
  for (const lead of affected) {
    const meta = (lead.originMetadata ?? {}) as Record<string, unknown>;
    console.info(
      [
        lead.id,
        lead.team?.name ?? lead.teamId ?? "—",
        JSON.stringify(lead.name ?? ""),
        lead.email ?? "",
        lead.phone ?? "",
        lead.status,
        lead.createdAt.toISOString(),
        (meta.campaignId as string) ?? "",
        (meta.emailLogId as string) ?? "",
      ].join(","),
    );
  }
}

main()
  .catch((error) => {
    console.error("[audit-fake-email-attribution-leads]", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
