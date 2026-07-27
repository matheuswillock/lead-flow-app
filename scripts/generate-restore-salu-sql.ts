/**
 * One-shot: gera SQL de restore a partir do CSV de recuperação Salu.
 * Uso: bun scripts/generate-restore-salu-sql.ts
 */
import fs from "node:fs"
import path from "node:path"

const CSV_PATH = path.join(
  process.cwd(),
  "tmp/recovery/salu-leads-agendados-recuperados-20260724.csv"
)
const OUT_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260724231414_restore-salu-leads-20260724.sql"
)

const TEAM = "a94fc469-4603-487f-ab7f-e2712197d510"
const CLOSER = "3870aadb-8625-4184-ac60-c6e20be4cdc5"

const VALID_STATUSES = new Set([
  "new_opportunity",
  "scheduled",
  "no_show",
  "pricingRequest",
  "future_sale",
  "offerNegotiation",
  "pending_documents",
  "offerSubmission",
  "dps_agreement",
  "invoicePayment",
  "disqualified",
  "opportunityLost",
  "operator_denied",
  "contract_finalized",
])

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"' && content[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(cell)
      cell = ""
    } else if (c === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (c !== "\r") {
      cell += c
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function sqlEsc(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL"
  return `'${String(v).replace(/'/g, "''")}'`
}

function sqlNum(v: string | null | undefined): string {
  if (!v) return "NULL"
  const n = Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? String(n) : "NULL"
}

function mapStatus(s: string): string {
  if (!s) return "scheduled"
  if (VALID_STATUSES.has(s)) return s
  return "scheduled"
}

function mapMeetingHeald(v: string): string {
  if (v === "yes") return "'yes'::\"MeetingHeald\""
  if (v === "no") return "'no'::\"MeetingHeald\""
  return "NULL"
}

function meetingTimestamp(date: string, time: string, tz: string): string {
  if (!date) return "NULL"
  const t = time || "00:00"
  // Interpret as America/Sao_Paulo wall time → timestamptz via AT TIME ZONE
  return `(${sqlEsc(`${date} ${t}:00`)}::timestamp AT TIME ZONE ${sqlEsc(tz || "America/Sao_Paulo")})`
}

const text = fs.readFileSync(CSV_PATH, "utf8")
const rows = parseCsv(text)
const headers = rows[0]
const data = rows.slice(1).filter((r) => r.length > 1 && r[0])

const out: string[] = []
out.push("-- Restore 36 leads Salu Seguros (incidente hard-delete).")
out.push(
  "-- Fontes: dump_20260618 + EmailLog/Resend + resend_export (tmp/recovery/salu-leads-agendados-recuperados-20260724.csv)"
)
out.push(
  `-- teamId=${TEAM}; closer=Giovanna (${CLOSER}); assignedTo=NULL (Bruna Molina removida).`
)
out.push("-- Idempotente: ON CONFLICT (leadCode) DO NOTHING; schedule por leadId único.")
out.push("")
out.push("DO $$")
out.push("DECLARE")
out.push(`  v_team uuid := ${sqlEsc(TEAM)};`)
out.push(`  v_closer uuid := ${sqlEsc(CLOSER)};`)
out.push("  v_manager uuid;")
out.push("  v_lead_id uuid;")
out.push("BEGIN")
out.push('  SELECT "masterId" INTO v_manager FROM "public"."corretor_studio_teams" WHERE id = v_team;')
out.push("  IF v_manager IS NULL THEN")
out.push("    RAISE NOTICE 'Team Salu não encontrado — skip restore';")
out.push("    RETURN;")
out.push("  END IF;")
out.push(
  '  IF NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_profiles" WHERE id = v_closer AND "deletedAt" IS NULL) THEN'
)
out.push("    v_closer := NULL;")
out.push("  END IF;")
out.push("")

for (const r of data) {
  const o = Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))
  const leadCode = o.leadCode
  const leadId = o.leadId || ""
  const name = o.nome || leadCode
  const email = o.emailLead || ""
  const phone = o.telefone || ""
  const cnpj = o.cnpj || ""
  const status = mapStatus(o.status)
  const notesParts: string[] = []
  if (o.notas) notesParts.push(o.notas)
  if (o.fonte) notesParts.push(`[restore:${o.fonte}]`)
  if (o.completude === "parcial") notesParts.push("[parcial — dados incompletos na recuperação]")
  const notes = notesParts.join("\n") || ""
  const tz = o.timezone || "America/Sao_Paulo"
  const meetingDateExpr = meetingTimestamp(o.dataAgendamento, o.horarioAgendamento, tz)
  const idExpr = leadId ? `${sqlEsc(leadId)}::uuid` : "gen_random_uuid()"
  const createdExpr = o.createdAtUtc
    ? `${sqlEsc(o.createdAtUtc)}::timestamptz`
    : "now()"
  const updatedExpr = o.updatedAtUtc
    ? `${sqlEsc(o.updatedAtUtc)}::timestamptz`
    : "now()"

  out.push('  INSERT INTO "public"."corretor_studio_leads" (')
  out.push(
    '    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",'
  )
  out.push(
    '    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",'
  )
  out.push(
    '    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",'
  )
  out.push(
    '    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",'
  )
  out.push('    "createdAt", "updatedAt", "statusEnteredAt"')
  out.push("  ) VALUES (")
  out.push(`    ${idExpr},`)
  out.push(`    ${sqlEsc(leadCode)},`)
  out.push(`    ${sqlEsc(name)},`)
  out.push(`    ${sqlEsc(email)},`)
  out.push(`    ${sqlEsc(phone)},`)
  out.push(`    ${sqlEsc(cnpj)},`)
  out.push(`    ${sqlEsc(status)}::"LeadStatus",`)
  out.push("    v_team,")
  out.push("    v_manager,")
  out.push("    NULL,")
  out.push("    v_closer,")
  out.push(`    ${sqlEsc(notes)},`)
  out.push(`    ${sqlEsc(o.meetingNotes)},`)
  out.push(`    ${sqlEsc(o.meetingTitle)},`)
  out.push(`    ${sqlEsc(o.meetingLink)},`)
  out.push(`    ${sqlEsc(o.meetingType)},`)
  out.push(`    ${mapMeetingHeald(o.meetingHeld)},`)
  out.push(`    ${meetingDateExpr},`)
  out.push(`    ${sqlNum(o.ticket)},`)
  out.push(`    ${sqlEsc(o.soldPlan)},`)
  out.push(`    ${sqlEsc(o.lossReason)},`)
  out.push(
    `    ${o.contractDueDate ? `${sqlEsc(o.contractDueDate)}::timestamptz` : "NULL"},`
  )
  out.push(`    ${sqlEsc(o.planoAtual)},`)
  out.push(`    ${sqlNum(o.valorAtual)},`)
  out.push(`    ${sqlEsc(o.hospitalReferencia)},`)
  out.push(`    ${sqlEsc(o.tratamentoAtual)},`)
  out.push(`    ${sqlEsc(o.idades)},`)
  out.push(`    ${createdExpr},`)
  out.push(`    ${updatedExpr},`)
  out.push(`    ${createdExpr}`)
  out.push('  ) ON CONFLICT ("leadCode") DO NOTHING;')
  out.push("")

  if (o.meetingLink && o.dataAgendamento) {
    out.push(
      `  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = ${sqlEsc(leadCode)};`
    )
    out.push("  IF v_lead_id IS NOT NULL THEN")
    out.push('    INSERT INTO "public"."corretor_studio_leads_schedule" (')
    out.push(
      '      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"'
    )
    out.push("    )")
    out.push("    SELECT")
    out.push("      gen_random_uuid(),")
    out.push("      v_lead_id,")
    out.push(`      ${meetingDateExpr},`)
    out.push(`      ${sqlEsc(o.meetingLink)},`)
    out.push(`      ${sqlEsc(o.meetingTitle || `Reunião: ${name}`)},`)
    out.push(`      ${sqlEsc(o.meetingType)},`)
    out.push(`      ${sqlEsc(o.meetingNotes)},`)
    out.push("      now(),")
    out.push("      now()")
    out.push(
      '    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);'
    )
    out.push("  END IF;")
    out.push("")
  }
}

out.push("END $$;")
out.push("")

fs.writeFileSync(OUT_PATH, out.join("\n"))
console.info(`Wrote ${data.length} leads → ${OUT_PATH}`)
