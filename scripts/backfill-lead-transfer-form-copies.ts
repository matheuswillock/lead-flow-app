#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Backfill: copia respostas de formulário público para o time destino em transferências
 * de lead feitas ANTES da correção em `lib/public-forms/lead-transfer-submission-copy.ts`
 * (2026-08-10). Sem esse backfill, leads transferidos antes dessa data continuam sem
 * cópia própria no time destino — `listLeadSubmissions` ainda mostra o histórico via
 * fallback cross-team, mas o time destino não tem a submission no seu próprio Radar/CRM.
 *
 * Uso:
 *   bunx tsx scripts/backfill-lead-transfer-form-copies.ts                    # dry-run (padrão)
 *   bunx tsx scripts/backfill-lead-transfer-form-copies.ts --apply            # aplica de fato
 *   bunx tsx scripts/backfill-lead-transfer-form-copies.ts --email=x@y.com
 *   bunx tsx scripts/backfill-lead-transfer-form-copies.ts --leadId=<uuid>
 *   bunx tsx scripts/backfill-lead-transfer-form-copies.ts --from=2026-08-01 --to=2026-08-09
 *
 * Idempotente: usa o mesmo `requestKey` determinístico do fluxo em tempo real
 * (`lead-transfer-copy:<sourceSubmissionId>:<targetTeamId>`) — rodar de novo não duplica.
 */
import { prisma } from "@/app/api/infra/data/prisma"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"

function parseArgs() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const get = (flag: string) => {
    const found = args.find((a) => a.startsWith(`--${flag}=`))
    return found ? found.slice(flag.length + 3) : undefined
  }
  const fromRaw = get("from")
  const toRaw = get("to")
  return {
    apply,
    email: get("email"),
    leadId: get("leadId"),
    from: fromRaw ? new Date(fromRaw) : undefined,
    to: toRaw ? new Date(toRaw) : undefined,
  }
}

async function main() {
  const { apply, email, leadId, from, to } = parseArgs()

  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`)
  if (email) console.log(`Filtro email: ${email}`)
  if (leadId) console.log(`Filtro leadId: ${leadId}`)
  if (from || to) console.log(`Filtro período: ${from?.toISOString() ?? "-"} .. ${to?.toISOString() ?? "-"}`)

  const transfers = await prisma.leadTransfer.findMany({
    where: {
      ...(leadId ? { leadId } : {}),
      ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
      ...(email ? { lead: { email: { equals: email, mode: "insensitive" } } } : {}),
    },
    select: {
      id: true,
      leadId: true,
      fromTeamId: true,
      toTeamId: true,
      createdAt: true,
      lead: { select: { name: true, email: true, leadCode: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  console.log(`${transfers.length} transferência(s) encontrada(s) no filtro.`)

  let totalCopied = 0
  let totalSkipped = 0
  let withSubmissions = 0

  for (const transfer of transfers) {
    const pendingCount = await prisma.publicFormSubmission.count({
      where: { leadId: transfer.leadId, form: { teamId: transfer.fromTeamId } },
    })
    if (pendingCount === 0) continue

    withSubmissions += 1
    console.log(
      `\nLead ${transfer.lead.leadCode ?? transfer.leadId} (${transfer.lead.name} / ${transfer.lead.email ?? "sem email"}) — ` +
        `${transfer.fromTeamId} → ${transfer.toTeamId} em ${transfer.createdAt.toISOString()} — ${pendingCount} submission(s) na origem`
    )

    if (!apply) continue

    const result = await publicFormsRepository.copyLeadSubmissionsOnTeamTransfer({
      leadId: transfer.leadId,
      sourceTeamId: transfer.fromTeamId,
      targetTeamId: transfer.toTeamId,
    })
    totalCopied += result.copied
    totalSkipped += result.skipped
    console.log(`  -> copiadas: ${result.copied}, ja existentes (skip): ${result.skipped}`)
  }

  console.log(`\n${withSubmissions} transferência(s) com submissions pendentes na origem.`)
  if (apply) {
    console.log(`Total copiado: ${totalCopied}. Total já existente (skip): ${totalSkipped}.`)
  } else {
    console.log("Dry-run — nenhuma cópia foi criada. Rode de novo com --apply para aplicar.")
  }
}

main()
  .catch((error) => {
    console.error("Erro no backfill:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
