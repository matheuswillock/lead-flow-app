/**
 * Auditoria local: notificações ao mover lead de conta associada para Proposta.
 *
 * Uso:
 *   bun scripts/audit-associate-proposal-notifications.ts           # somente leitura
 *   bun scripts/audit-associate-proposal-notifications.ts --simulate # dispara fluxo de teste
 */
import { LeadStatus, NotificationType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { associateProposalRepository } from "@/app/api/infra/data/repositories/associateProposal/AssociateProposalRepository";
import { associateProposalService } from "@/app/api/services/associateProposal/AssociateProposalService";

const BRUNO_PROFILE_ID = "0c96a57e-6cc1-400f-bf3a-5740b699ac21";
const SIMULATE = process.argv.includes("--simulate");

type Row = Record<string, unknown>;

function section(title: string) {
  console.info(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}

async function queryAssociates() {
  return prisma.$queryRaw<Row[]>`
    SELECT assoc.id, assoc.email, assoc."fullName", assoc."sponsorMasterId",
           sponsor.email AS sponsor_email
    FROM corretor_studio_profiles assoc
    LEFT JOIN corretor_studio_profiles sponsor ON sponsor.id = assoc."sponsorMasterId"
    WHERE assoc."sponsorMasterId" IS NOT NULL
  `;
}

async function queryProposalQueue() {
  return prisma.$queryRaw<Row[]>`
    SELECT l.id, l."leadCode", l.name, l.status, l."statusEnteredAt",
           master.email AS associate_master_email,
           sponsor.email AS sponsor_email
    FROM corretor_studio_leads l
    JOIN corretor_studio_teams t ON t.id = l."teamId"
    JOIN corretor_studio_profiles master ON master.id = t."masterId"
    LEFT JOIN corretor_studio_profiles sponsor ON sponsor.id = master."sponsorMasterId"
    WHERE l.status = 'offerSubmission' AND master."sponsorMasterId" IS NOT NULL
    ORDER BY l."statusEnteredAt" DESC
    LIMIT 20
  `;
}

async function queryProposalNotifications(limit = 30) {
  return prisma.$queryRaw<Row[]>`
    SELECT n.id, n."createdAt", n.type, n."teamId", n."recipientProfileId",
           n.message, n.metadata->>'leadCode' AS lead_code,
           n.metadata->>'nextStatus' AS next_status,
           recipient.email AS recipient_email,
           t.name AS notification_team_name,
           tm_master.email AS team_master_email
    FROM corretor_studio_notifications n
    JOIN corretor_studio_profiles recipient ON recipient.id = n."recipientProfileId"
    JOIN corretor_studio_teams t ON t.id = n."teamId"
    JOIN corretor_studio_profiles tm_master ON tm_master.id = t."masterId"
    WHERE n.type = 'LEAD_PROPOSAL_PENDING'
    ORDER BY n."createdAt" DESC
    LIMIT ${limit}
  `;
}

async function findSimulationFixture() {
  const rows = await prisma.$queryRaw<
    Array<{
      leadId: string;
      leadCode: string;
      leadName: string;
      teamId: string;
      masterId: string;
      masterEmail: string;
      previousStatus: LeadStatus;
    }>
  >`
    SELECT l.id AS "leadId", l."leadCode", l.name AS "leadName", l."teamId",
           m.id AS "masterId", m.email AS "masterEmail", l.status AS "previousStatus"
    FROM corretor_studio_leads l
    JOIN corretor_studio_teams t ON t.id = l."teamId"
    JOIN corretor_studio_profiles m ON m.id = t."masterId"
    WHERE m."sponsorMasterId" IS NULL
      AND m.id != ${BRUNO_PROFILE_ID}::uuid
      AND l.status = 'offerNegotiation'
    ORDER BY l."updatedAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function createProposalPendingNotifications(input: {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  recipientProfileIds: string[];
  leadId: string;
  leadCode: string;
  leadName: string;
  notes: string | null;
  previousStatus: LeadStatus;
  nextStatus: LeadStatus;
}) {
  const uniqueRecipients = Array.from(new Set(input.recipientProfileIds.filter(Boolean)));
  if (uniqueRecipients.length === 0) return { createdCount: 0 };

  const message = `${input.actorName} moveu o lead ${input.leadName} para proposta pendente.`;
  const result = await prisma.notification.createMany({
    data: uniqueRecipients.map((recipientProfileId) => ({
      recipientProfileId,
      actorProfileId: input.actorProfileId,
      teamId: input.teamId,
      type: NotificationType.LEAD_PROPOSAL_PENDING,
      message,
      metadata: {
        leadId: input.leadId,
        leadCode: input.leadCode,
        leadName: input.leadName,
        leadEmail: null,
        leadPhone: null,
        sdrName: "—",
        closerName: "—",
        notes: input.notes,
        previousStatus: input.previousStatus,
        nextStatus: input.nextStatus,
      },
    })),
  });

  return { createdCount: result.count };
}

async function dispatchAssociateOfferNotifications(input: {
  leadId: string;
  teamId: string;
  leadCode: string;
  leadName: string;
  actorProfileId: string;
  actorName: string;
}) {
  const recipients = await associateProposalService.findAssociateOfferNotificationRecipients(
    input.teamId
  );
  if (!recipients?.recipientIds.length) return { recipients, createdCount: 0 };

  await associateProposalService.ensureProposalArtifacts(input.leadId);

  const hasPending = await associateProposalService.hasPendingRequiredDocuments(input.leadId);
  if (hasPending) {
    await createProposalPendingNotifications({
      teamId: input.teamId,
      actorProfileId: input.actorProfileId,
      actorName: input.actorName,
      recipientProfileIds: recipients.recipientIds,
      leadId: input.leadId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      notes: "Revise e aprove os documentos obrigatórios na fila Associados.",
      previousStatus: LeadStatus.offerNegotiation,
      nextStatus: LeadStatus.pending_documents,
    });
  }

  const result = await createProposalPendingNotifications({
    teamId: input.teamId,
    actorProfileId: input.actorProfileId,
    actorName: input.actorName,
    recipientProfileIds: recipients.recipientIds,
    leadId: input.leadId,
    leadCode: input.leadCode,
    leadName: input.leadName,
    notes: "Proposta de conta associada aguardando registro na operadora.",
    previousStatus: LeadStatus.offerNegotiation,
    nextStatus: LeadStatus.offerSubmission,
  });

  return { recipients, createdCount: result.createdCount };
}

async function listNotificationsForLead(leadCode: string, after: Date) {
  return prisma.notification.findMany({
    where: {
      type: "LEAD_PROPOSAL_PENDING",
      createdAt: { gte: after },
      metadata: { path: ["leadCode"], equals: leadCode },
    },
    select: {
      id: true,
      recipientProfileId: true,
      teamId: true,
      message: true,
      metadata: true,
      recipient: { select: { email: true, fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function runReadOnlyAudit() {
  section("1. Contas associadas (sponsorMasterId preenchido)");
  const associates = await queryAssociates();
  if (associates.length === 0) {
    console.info("Nenhuma conta associada no banco local.");
  } else {
    console.info(JSON.stringify(associates, null, 2));
  }

  section("2. Fila Associados (leads em offerSubmission de contas patrocinadas)");
  const queue = await queryProposalQueue();
  if (queue.length === 0) {
    console.info("Nenhum lead em Proposta de conta patrocinada.");
  } else {
    console.info(JSON.stringify(queue, null, 2));
  }

  section("3. Últimas notificações LEAD_PROPOSAL_PENDING");
  const notifications = await queryProposalNotifications();
  console.info(`Total listado: ${notifications.length}`);
  if (notifications.length > 0) {
    console.info(
      JSON.stringify(
        notifications.map((n) => ({
          createdAt: n.createdAt,
          lead_code: n.lead_code,
          recipient: n.recipient_email,
          team: n.notification_team_name,
          team_master: n.team_master_email,
          next_status: n.next_status,
        })),
        null,
        2
      )
    );
  }

  section("4. Análise teamId vs patrocinador (notificações recentes)");
  const sponsorTeams = await prisma.team.findMany({
    where: { masterId: BRUNO_PROFILE_ID },
    select: { id: true, name: true },
  });
  const sponsorTeamIds = new Set(sponsorTeams.map((t) => t.id));

  const brunoNotifications = notifications.filter(
    (n) => n.recipient_email === "bruno@onsidemarketing.com.br"
  );
  if (brunoNotifications.length === 0) {
    console.info("Sem notificações recentes para bruno@onsidemarketing.com.br na amostra.");
  } else {
    for (const n of brunoNotifications.slice(0, 5)) {
      const teamId = String(n.teamId);
      const visibleOnBrunoActiveTeam = sponsorTeamIds.has(teamId);
      console.info({
        lead_code: n.lead_code,
        notification_team: n.notification_team_name,
        visible_if_bruno_on_own_team: visibleOnBrunoActiveTeam,
        diagnosis: visibleOnBrunoActiveTeam
          ? "OK — aparece no time ativo do Bruno"
          : "GAP — teamId é do time do associado; sino do Bruno no time próprio não mostra",
      });
    }
  }
}

async function runSimulation() {
  section("SIMULAÇÃO — disparo de notificações (conta associada → Proposta)");

  const fixture = await findSimulationFixture();
  if (!fixture) {
    console.error(
      "Não foi possível achar lead em offerNegotiation de master sem patrocinador. Abortando."
    );
    process.exit(1);
  }

  console.info("Fixture:", fixture);

  const before = new Date();
  const previousSponsorMasterId = await prisma.profile.findUnique({
    where: { id: fixture.masterId },
    select: { sponsorMasterId: true },
  });

  try {
    await prisma.profile.update({
      where: { id: fixture.masterId },
      data: { sponsorMasterId: BRUNO_PROFILE_ID },
    });

    await prisma.lead.update({
      where: { id: fixture.leadId },
      data: { status: LeadStatus.offerSubmission, statusEnteredAt: new Date() },
    });

    const recipients = await associateProposalRepository.findAssociateOfferNotificationRecipients(
      fixture.teamId
    );
    console.info("\nDestinatários esperados (findAssociateOfferNotificationRecipients):");
    console.info(recipients);

    if (!recipients?.recipientIds.length) {
      console.error("FALHA: nenhum destinatário retornado pelo repositório.");
      process.exit(1);
    }

    const dispatch = await dispatchAssociateOfferNotifications({
      leadId: fixture.leadId,
      teamId: fixture.teamId,
      leadCode: fixture.leadCode,
      leadName: fixture.leadName,
      actorProfileId: fixture.masterId,
      actorName: fixture.masterEmail,
    });
    console.info("\nDispatch result:", {
      createdCount: dispatch.createdCount,
      recipientIds: dispatch.recipients?.recipientIds,
      recipientEmails: dispatch.recipients?.recipientEmails,
    });

    await new Promise((r) => setTimeout(r, 500));

    const created = await listNotificationsForLead(fixture.leadCode, before);
    const createdCount = created.length;

    console.info(`\nNotificações criadas para ${fixture.leadCode}: ${createdCount}`);
    console.info(
      JSON.stringify(
        created.map((n) => ({
          email: n.recipient.email,
          teamId: n.teamId,
          nextStatus: (n.metadata as { nextStatus?: string })?.nextStatus,
          message: n.message.slice(0, 80),
        })),
        null,
        2
      )
    );

    const expectedEmails = new Set(
      (recipients.recipientEmails ?? []).map((e) => e.toLowerCase())
    );
    const receivedEmails = new Set(
      created.map((n) => (n.recipient.email ?? "").toLowerCase()).filter(Boolean)
    );

    const missing = [...expectedEmails].filter((e) => !receivedEmails.has(e));
    const extra = [...receivedEmails].filter((e) => !expectedEmails.has(e));

    const sponsorTeamIds = new Set(
      (await prisma.team.findMany({ where: { masterId: BRUNO_PROFILE_ID }, select: { id: true } })).map(
        (t) => t.id
      )
    );
    const brunoNotifs = created.filter((n) => n.recipientProfileId === BRUNO_PROFILE_ID);
    const brunoTeamMismatch = brunoNotifs.some((n) => !sponsorTeamIds.has(n.teamId));

    section("RESULTADO DA SIMULAÇÃO");
    console.info({
      leadCode: fixture.leadCode,
      expectedRecipientEmails: [...expectedEmails],
      receivedRecipientEmails: [...receivedEmails],
      missingInApp: missing,
      unexpectedInApp: extra,
      brunoNotificationTeamIdMismatch: brunoTeamMismatch,
      proposalReviewCreated: await prisma.leadProposalReview.count({
        where: { leadId: fixture.leadId },
      }),
      requiredDocsCreated: await prisma.leadRequiredDocument.count({
        where: { leadId: fixture.leadId },
      }),
      verdict:
        missing.length === 0 && createdCount > 0
          ? brunoTeamMismatch
            ? "PARCIAL — notificações gravadas, mas Bruno não vê no time próprio (teamId)"
            : "OK — destinatários notificados in-app"
          : "FALHA — destinatários ausentes",
    });
  } finally {
    await prisma.notification.deleteMany({
      where: {
        type: NotificationType.LEAD_PROPOSAL_PENDING,
        createdAt: { gte: before },
        metadata: { path: ["leadCode"], equals: fixture.leadCode },
      },
    });
    await prisma.leadRequiredDocument.deleteMany({ where: { leadId: fixture.leadId } });
    await prisma.leadProposalReview.deleteMany({ where: { leadId: fixture.leadId } });
    await prisma.lead.update({
      where: { id: fixture.leadId },
      data: {
        status: fixture.previousStatus,
        statusEnteredAt: new Date(),
      },
    });
    await prisma.profile.update({
      where: { id: fixture.masterId },
      data: { sponsorMasterId: previousSponsorMasterId?.sponsorMasterId ?? null },
    });
  }
}

async function main() {
  console.info(`[audit-associate-proposal-notifications] banco local | simulate=${SIMULATE}`);

  await runReadOnlyAudit();

  if (SIMULATE) {
    await runSimulation();
  } else {
    section("Próximo passo");
    console.info(
      "Para disparar o fluxo de notificação em ambiente local com fixture temporária:\n" +
        "  bun scripts/audit-associate-proposal-notifications.ts --simulate"
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
