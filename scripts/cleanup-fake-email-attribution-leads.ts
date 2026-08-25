import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Cleanup de leads fantasma criados por atribuição de e-mail em `form_started` /
 * `form_viewed` (ResolveEmailCampaignFormAttributionUseCase), sem PublicFormSubmission.
 *
 * Critério (mesmo do audit `scripts/audit-fake-email-attribution-leads.ts`):
 *   - originMetadata.attribution === "email_campaign"
 *   - nenhuma PublicFormSubmission aponta para o leadId
 *   - createdAt dentro da janela UTC configurável
 *   - opcional: teamId (--teamId / --avalanche)
 *
 * Avalanche (13/08/2026) — campanha "Alto Padrão · Form 1 · Dia 1":
 *   - teamId: aef1bfe7-d1fc-4085-879e-81d51a0cc9b8
 *   - janela UTC: 2026-08-12 .. 2026-08-13
 *   - evidência: 4 starts / 0 completes → 4 leads CRM com e-mail no nome e telefone fixo
 *   - dry-run: bun run cleanup:fake-email-attribution-leads -- --avalanche
 *   - NÃO apagar Radar: os perfis engajados (form.started) devem permanecer
 *
 * Dry-run por padrão. NÃO toca RadarProfile / RadarEvent / RadarIdentity.
 *
 * Em `--apply`: hard-delete do Lead. FKs CRM com onDelete: Cascade
 * (activities, tasks, schedules, finalized, transfers, portfolio, attachments,
 * proposalReview, requiredDocuments, customFieldValues) saem juntos.
 * WhatsAppConversation/Message e PublicFormSubmission usam onDelete: SetNull
 * (nossos candidatos não têm submission; WhatsApp tipicamente ausente).
 * referrerLeadId em outros leads: SetNull.
 *
 * GATE `--apply`:
 *   Só executar DEPOIS do gatilho de criação (form_completed + validação) em produção
 *   + autorização explícita do owner. Sem o fix, o bug recria leads na hora seguinte.
 *   Este PR NÃO roda `--apply` no remoto.
 *
 * Uso:
 *   bun run cleanup:fake-email-attribution-leads
 *   bun run cleanup:fake-email-attribution-leads -- --help
 *   bun run cleanup:fake-email-attribution-leads -- --avalanche
 *   bun run cleanup:fake-email-attribution-leads -- --from 2026-08-12 --to 2026-08-13 --teamId aef1bfe7-d1fc-4085-879e-81d51a0cc9b8
 *   bun run cleanup:fake-email-attribution-leads -- --day 2026-08-05
 *   bun run cleanup:fake-email-attribution-leads -- --apply   # só com OK do owner
 *
 * Env (alternativa às flags de data):
 *   FAKE_EMAIL_ATTRIBUTION_FROM / FAKE_EMAIL_ATTRIBUTION_TO (YYYY-MM-DD, UTC)
 *   FAKE_EMAIL_ATTRIBUTION_TEAM_ID (UUID)
 */

/** Incidente inicial (Kathrein / genérico) — default histórico do script. */
const DEFAULT_INCIDENT_DAY = "2026-08-05";

/**
 * Avalanche de Vendas Unipessoal Ltda — janela do incidente 12–13/08/2026.
 * Preset `--avalanche` aplica estas constantes.
 */
const AVALANCHE_TEAM_ID = "aef1bfe7-d1fc-4085-879e-81d51a0cc9b8";
const AVALANCHE_FROM_DAY = "2026-08-12";
const AVALANCHE_TO_DAY = "2026-08-13";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const prisma = new PrismaClient();

type DateWindow = { fromInclusive: Date; toExclusive: Date; fromDay: string; toDay: string };

function printHelp(): void {
  console.info(`Usage:
  bun run cleanup:fake-email-attribution-leads [-- --help]
  bun run cleanup:fake-email-attribution-leads [-- --avalanche]
  bun run cleanup:fake-email-attribution-leads [-- --day YYYY-MM-DD]
  bun run cleanup:fake-email-attribution-leads [-- --from YYYY-MM-DD --to YYYY-MM-DD]
  bun run cleanup:fake-email-attribution-leads [-- --teamId UUID]
  bun run cleanup:fake-email-attribution-leads [-- --apply]

Default: dry-run, janela UTC = ${DEFAULT_INCIDENT_DAY}.
--avalanche: dry-run na janela ${AVALANCHE_FROM_DAY}..${AVALANCHE_TO_DAY} + teamId Avalanche
  (${AVALANCHE_TEAM_ID}). Não apaga Radar.
--apply: hard-delete dos leads selecionados. Só após fix de criação em prod + OK do owner.
Nunca altera RadarProfile/RadarEvent.`);
}

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

function resolveDateWindow(args: string[]): DateWindow {
  const avalanche = args.includes("--avalanche");
  const dayIdx = args.indexOf("--day");
  const fromIdx = args.indexOf("--from");
  const toIdx = args.indexOf("--to");

  let fromDay =
    process.env.FAKE_EMAIL_ATTRIBUTION_FROM?.trim() ||
    (avalanche ? AVALANCHE_FROM_DAY : DEFAULT_INCIDENT_DAY);
  let toDay =
    process.env.FAKE_EMAIL_ATTRIBUTION_TO?.trim() ||
    (avalanche ? AVALANCHE_TO_DAY : fromDay);

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
  // --to é inclusivo no dia civil UTC → exclusive no dia seguinte
  const toExclusive = utcNextDay(toDay);

  if (fromInclusive >= toExclusive) {
    throw new Error(`Janela inválida: from=${fromDay} to=${toDay}`);
  }

  return { fromInclusive, toExclusive, fromDay, toDay };
}

function resolveTeamId(args: string[]): string | null {
  if (args.includes("--avalanche")) {
    const teamIdx = args.indexOf("--teamId");
    if (teamIdx !== -1) {
      const raw = args[teamIdx + 1];
      if (!raw) throw new Error("--teamId requer UUID");
      if (!UUID_RE.test(raw)) throw new Error(`--teamId inválido: "${raw}"`);
      return raw;
    }
    return AVALANCHE_TEAM_ID;
  }

  const teamIdx = args.indexOf("--teamId");
  if (teamIdx !== -1) {
    const raw = args[teamIdx + 1];
    if (!raw) throw new Error("--teamId requer UUID");
    if (!UUID_RE.test(raw)) throw new Error(`--teamId inválido: "${raw}"`);
    return raw;
  }

  const envTeam = process.env.FAKE_EMAIL_ATTRIBUTION_TEAM_ID?.trim();
  if (envTeam) {
    if (!UUID_RE.test(envTeam)) {
      throw new Error(`FAKE_EMAIL_ATTRIBUTION_TEAM_ID inválido: "${envTeam}"`);
    }
    return envTeam;
  }

  return null;
}

/** Mesmo critério do audit + filtro de createdAt na janela UTC (+ teamId opcional). */
function buildWhere(window: DateWindow, teamId: string | null): Prisma.LeadWhereInput {
  return {
    originMetadata: { path: ["attribution"], equals: "email_campaign" },
    publicFormSubmissions: { none: {} },
    createdAt: {
      gte: window.fromInclusive,
      lt: window.toExclusive,
    },
    ...(teamId ? { teamId } : {}),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const shouldApply = args.includes("--apply");
  const window = resolveDateWindow(args);
  const teamId = resolveTeamId(args);
  const where = buildWhere(window, teamId);

  console.info(
    `[cleanup-fake-email-attribution-leads] mode=${shouldApply ? "APPLY" : "dry-run"} windowUTC=${window.fromDay}..${window.toDay} (gte ${window.fromInclusive.toISOString()} lt ${window.toExclusive.toISOString()})${teamId ? ` teamId=${teamId}` : ""}`,
  );

  if (args.includes("--avalanche")) {
    console.info(
      "[cleanup-fake-email-attribution-leads] Preset Avalanche: CRM only; Radar engajados (form.started) permanecem intactos.",
    );
  }

  if (shouldApply) {
    console.info(
      "[cleanup-fake-email-attribution-leads] AVISO: --apply ativo. Exige fix de criação já em produção + OK do owner. Radar NÃO será tocado.",
    );
  } else {
    console.info(
      "[cleanup-fake-email-attribution-leads] Dry-run (padrão). Para mutar: --apply somente após fix em prod + autorização do owner.",
    );
  }

  const candidates = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      leadCode: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      teamId: true,
      team: { select: { name: true } },
      originMetadata: true,
      _count: {
        select: {
          activities: true,
          tasks: true,
          LeadsSchedule: true,
          LeadFinalized: true,
          transfers: true,
          attachments: true,
          requiredDocuments: true,
          customFieldValues: true,
          whatsappConversations: true,
          whatsappMessages: true,
          publicFormSubmissions: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // originMetadata.backfill identifica leads recuperados manualmente (nome/telefone/e-mail
  // reais, verificados por um operador) — mesmo predicado de "sem submission" de um lead
  // fantasma, mas não é fantasma. Nunca entram no escopo de exclusão.
  const affected = candidates.filter((lead) => !(lead.originMetadata as Record<string, unknown> | null)?.backfill);
  const excludedByBackfill = candidates.length - affected.length;

  console.info(
    `[cleanup-fake-email-attribution-leads] ${affected.length} lead(s) no escopo${excludedByBackfill ? ` (${excludedByBackfill} excluído(s) por originMetadata.backfill — recuperados com identidade real, não são fantasmas)` : ""}`,
  );

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
  console.info(
    "id,leadCode,teamName,name,email,phone,status,createdAt,activities,tasks,schedules,campaignId,emailLogId",
  );
  for (const lead of affected) {
    const meta = (lead.originMetadata ?? {}) as Record<string, unknown>;
    console.info(
      [
        lead.id,
        lead.leadCode,
        lead.team?.name ?? lead.teamId ?? "—",
        JSON.stringify(lead.name ?? ""),
        lead.email ?? "",
        lead.phone ?? "",
        lead.status,
        lead.createdAt.toISOString(),
        lead._count.activities,
        lead._count.tasks,
        lead._count.LeadsSchedule,
        (meta.campaignId as string) ?? "",
        (meta.emailLogId as string) ?? "",
      ].join(","),
    );

    if (lead._count.publicFormSubmissions > 0) {
      throw new Error(
        `Guardrail: lead ${lead.id} tem PublicFormSubmission — abortando (critério violado)`,
      );
    }
  }

  if (!shouldApply) {
    console.info(
      `\n[cleanup-fake-email-attribution-leads] Dry-run concluído. Nenhuma exclusão. Reexecute com --apply para deletar ${affected.length} lead(s) (somente com autorização do owner).`,
    );
    return;
  }

  let deleted = 0;
  for (const lead of affected) {
    // Espelha LeadUseCase.deleteLead / LeadRepository.delete: hard-delete do Lead;
    // cascades Prisma cobrem filhos CRM. Não há delete em tabelas Radar*.
    await prisma.$transaction(async (tx) => {
      await tx.lead.delete({ where: { id: lead.id } });
    });
    deleted += 1;
    console.info(`[cleanup-fake-email-attribution-leads] deleted ${lead.id} (${lead.leadCode})`);
  }

  console.info(`[cleanup-fake-email-attribution-leads] APPLY concluído: ${deleted} lead(s) removidos`);
}

main()
  .catch((error) => {
    console.error("[cleanup-fake-email-attribution-leads]", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
