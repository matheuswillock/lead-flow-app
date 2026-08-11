#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/ban-ts-comment -- one-off script */
// @ts-nocheck
/**
 * One-off: promove para Lead os contatos que visualizaram o formulário
 * mas nunca responderam nenhuma pergunta (Achado E6 — funil quebrado clique→Lead).
 *
 * O Excel importado tem telefone_1/telefone_2 no customFields do EmailContact.
 * Este script cruza os form_viewed events (excluindo quem respondeu alguma pergunta)
 * com o EmailContact da lista da campanha para recuperar telefone e cria os Leads.
 *
 * Times conhecidos:
 *   Avalanche de Vendas: aef1bfe7-d1fc-4085-879e-81d51a0cc9b8
 *   Kathrein Antunes:    28f7b9e8-9516-4a08-864c-9ff3e085ba87
 *
 * Uso:
 *   bun run scripts/promote-form-viewers-to-leads.ts --team-id <uuid>           # dry-run
 *   bun run scripts/promote-form-viewers-to-leads.ts --team-id <uuid> --apply   # cria leads (requer autorização)
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

function getTeamId(): string {
  const idx = process.argv.indexOf("--team-id");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error(
      "Erro: --team-id <uuid> é obrigatório.\n" +
        "  Avalanche: aef1bfe7-d1fc-4085-879e-81d51a0cc9b8\n" +
        "  Kathrein:  28f7b9e8-9516-4a08-864c-9ff3e085ba87"
    );
    process.exit(1);
  }
  return process.argv[idx + 1];
}

const TEAM_ID = getTeamId();

type ContactData = {
  email: string;
  name: string | null;
  telefone: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  socios: string | null;
  formName: string;
  formViewedAt: Date;
  contactListId: string | null;
};

function extractPhone(customFields: Record<string, unknown> | null): string | null {
  if (!customFields) return null;
  const candidates = [
    customFields["telefone_1"],
    customFields["Telefone 1"],
    customFields["telefone1"],
    customFields["phone"],
    customFields["telefone"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

function extractString(
  customFields: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!customFields) return null;
  for (const key of keys) {
    const val = customFields[key];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  return null;
}

function generateLeadCode(name: string): string {
  const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const firstLetter = (clean[0] || "L").toUpperCase();
  const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();
  const digits = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join("");
  return `${firstLetter}${digits}${lastLetter}`;
}

async function getManagerProfileId(): Promise<string> {
  const manager = await prisma.teamMember.findFirst({
    where: { teamId: TEAM_ID, role: "manager" },
    select: { profileId: true },
  });
  if (!manager) throw new Error(`Nenhum manager encontrado no time ${TEAM_ID}`);
  return manager.profileId;
}

async function findFormViewers(): Promise<ContactData[]> {
  // form_viewed sem question_answered na mesma sessão (NOT EXISTS por visitorSessionId+formId)
  const events = await prisma.$queryRaw<
    Array<{
      email_log_id: string | null;
      dispatch_id: string | null;
      recipient_email_origin: string | null;
      form_name: string;
      form_viewed_at: Date;
    }>
  >`
    SELECT
      (pme.origin->>'emailLogId') AS email_log_id,
      (pme.origin->>'dispatchId') AS dispatch_id,
      (pme.origin->>'recipientEmail') AS recipient_email_origin,
      f.name AS form_name,
      pme."createdAt" AS form_viewed_at
    FROM corretor_studio_public_form_metric_events pme
    JOIN corretor_studio_public_forms f ON f.id = pme."formId"
    WHERE pme."eventType" = 'form_viewed'
      AND f."teamId" = ${TEAM_ID}::uuid
      AND NOT EXISTS (
        SELECT 1
        FROM corretor_studio_public_form_metric_events qa
        WHERE qa."visitorSessionId" = pme."visitorSessionId"
          AND qa."formId" = pme."formId"
          AND qa."eventType" = 'question_answered'
      )
    ORDER BY pme."createdAt" DESC
  `;

  console.info(`\n📋 ${events.length} form_viewed (sem question_answered) para o time ${TEAM_ID}`);

  const contacts: ContactData[] = [];
  const seenEmails = new Set<string>();

  for (const event of events) {
    let recipientEmail: string | null = event.recipient_email_origin ?? null;
    let contactListId: string | null = null;

    // Resolve email e contactListId via EmailLog → EmailCampaignDispatch
    if (event.email_log_id) {
      const log = await prisma.emailLog.findUnique({
        where: { id: event.email_log_id },
        select: {
          recipientEmail: true,
          dispatch: { select: { contactListId: true } },
        },
      });
      if (!recipientEmail) recipientEmail = log?.recipientEmail ?? null;
      contactListId = log?.dispatch?.contactListId ?? null;
    } else if (event.dispatch_id) {
      const dispatch = await prisma.emailCampaignDispatch.findUnique({
        where: { id: event.dispatch_id },
        select: { contactListId: true },
      });
      contactListId = dispatch?.contactListId ?? null;
    }

    if (!recipientEmail) {
      console.info(`  ⚠️  form_viewed em ${event.form_viewed_at.toISOString()} sem email — ignorando`);
      continue;
    }

    const email = recipientEmail.toLowerCase().trim();
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);

    // Busca o EmailContact restringindo à lista da campanha quando disponível
    const contactWhere = contactListId
      ? { email: { equals: email, mode: "insensitive" as const }, listId: contactListId }
      : { email: { equals: email, mode: "insensitive" as const }, list: { teamId: TEAM_ID } };

    const contact = await prisma.emailContact.findFirst({
      where: contactWhere,
      select: { email: true, name: true, customFields: true },
    });

    const cf = (contact?.customFields as Record<string, unknown> | null) ?? null;

    contacts.push({
      email,
      name: contact?.name ?? null,
      telefone: extractPhone(cf),
      razaoSocial: extractString(cf, "razaoSocial", "Razão Social", "razao_social"),
      nomeFantasia: extractString(cf, "nomeFantasia", "Nome Fantasia", "nome_fantasia"),
      socios: extractString(cf, "socios", "Sócios", "socios"),
      formName: event.form_name,
      formViewedAt: event.form_viewed_at,
      contactListId,
    });
  }

  return contacts;
}

async function main() {
  console.info("═══════════════════════════════════════════════════════");
  console.info(`🚀 Promover form viewers → Leads (team: ${TEAM_ID})`);
  console.info(`   Modo: ${APPLY ? "APPLY (grava no banco)" : "DRY-RUN"}`);
  console.info("═══════════════════════════════════════════════════════");

  const managerProfileId = await getManagerProfileId();
  console.info(`\n👤 Manager profile ID: ${managerProfileId}`);

  const viewers = await findFormViewers();
  console.info(`\n📊 ${viewers.length} e-mails únicos resolvidos:\n`);

  const firstWithCf = viewers.find((v) => v.telefone || v.razaoSocial);
  if (firstWithCf) {
    console.info(`   Exemplo de dados enriquecidos:`);
    console.info(`   email: ${firstWithCf.email}`);
    console.info(`   telefone: ${firstWithCf.telefone ?? "(sem telefone)"}`);
    console.info(`   razaoSocial: ${firstWithCf.razaoSocial ?? "(vazio)"}`);
    console.info(`   contactListId: ${firstWithCf.contactListId ?? "(não resolvida)"}`);
    console.info("");
  }

  let created = 0;
  let skipped = 0;
  let noPhone = 0;

  for (const viewer of viewers) {
    const existing = await prisma.lead.findFirst({
      where: {
        teamId: TEAM_ID,
        email: { equals: viewer.email, mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (existing) {
      console.info(`  ⏭️  ${viewer.email} → Lead já existe (${existing.name})`);
      skipped++;
      continue;
    }

    const leadName =
      viewer.razaoSocial ||
      viewer.nomeFantasia ||
      viewer.name ||
      viewer.email;

    const phone = viewer.telefone;
    if (!phone) noPhone++;

    console.info(`  ${APPLY ? "✅" : "🔍"} ${viewer.email}`);
    console.info(`     nome: ${leadName}`);
    console.info(`     telefone: ${phone ?? "(sem telefone — Lead será criado com nota)"}`);
    console.info(`     formulário: ${viewer.formName} | visualizado em: ${viewer.formViewedAt.toISOString()}`);

    if (!APPLY) continue;

    let leadCode: string;
    let codeAttempts = 0;
    do {
      leadCode = generateLeadCode(leadName);
      const exists = await prisma.lead.findFirst({ where: { leadCode }, select: { id: true } });
      if (!exists) break;
      codeAttempts++;
    } while (codeAttempts < 10);

    const notes = [
      "Lead criado a partir de visualização de formulário via campanha de e-mail (sem preenchimento).",
      !phone ? "⚠️ Contato sem telefone — enriquecer manualmente." : null,
      viewer.socios ? `Sócios identificados: ${viewer.socios}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await prisma.lead.create({
      data: {
        leadCode,
        managerId: managerProfileId,
        teamId: TEAM_ID,
        createdBy: managerProfileId,
        status: "new_opportunity",
        name: leadName,
        email: viewer.email,
        phone: phone ?? undefined,
        razaoSocial: viewer.razaoSocial ?? undefined,
        originChannel: "public_form",
        originMetadata: {
          source: "form_viewed",
          formName: viewer.formName,
          formViewedAt: viewer.formViewedAt.toISOString(),
          promotedBy: "script:promote-form-viewers-to-leads",
        },
        notes,
      },
    });

    created++;
  }

  console.info("\n═══════════════════════════════════════════════════════");
  console.info(`📊 Resultado:`);
  console.info(`   Criados: ${APPLY ? created : `${viewers.length - skipped} (dry-run, não gravados)`}`);
  console.info(`   Já existiam: ${skipped}`);
  console.info(`   Sem telefone: ${noPhone}`);
  if (!APPLY) {
    console.info("\n⚡ Execute com --apply para gravar os leads no banco.");
    console.info("   ATENÇÃO: solicite autorização do owner antes de rodar --apply em produção.");
  }
  console.info("═══════════════════════════════════════════════════════");
}

main()
  .catch((err) => {
    console.error("[promote-form-viewers-to-leads] erro fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
