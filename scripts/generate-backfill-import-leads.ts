import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";

const MANAGER_PROFILE_ID = "1b1cc33f-1aea-4877-bc53-ca49d52ee764";

type Row = Record<string, unknown>;

function fileExists(p: string) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "nan") return null;
  return s;
}

function sqlEscapeLiteral(v: string): string {
  // ' -> ''
  return v.replace(/'/g, "''");
}

function sqlTextOrNull(v: string | null): string {
  return v ? `'${sqlEscapeLiteral(v)}'` : "NULL";
}

function digitsOnly(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D+/g, "");
  return d.length ? d : null;
}

function normalizeEmail(v: string | null): string | null {
  if (!v) return null;
  return v.trim().toLowerCase();
}

function parseCurrency(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v.toString();

  const s = String(v).trim();
  if (!s) return null;

  // "1.234,56" e "1234.56"
  const cleaned = s
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return num.toString();
}

// DB enum values por causa do @map no schema.prisma
function mapHealthPlanToDbLabel(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim();

  const map: Record<string, string> = {
    "Nova Adesao": "Nova Adesão",
    "Nova Adesão": "Nova Adesão",
    "Amil": "Amil",
    "Bradesco": "Bradesco",
    "Hapvida": "Hapvida",
    "Medsenior": "MedSênior",
    "MedSenior": "MedSênior",
    "MedSênior": "MedSênior",
    "GNDI": "NotreDame Intermédica (GNDI)",
    "NotreDame": "NotreDame Intermédica (GNDI)",
    "NotreDame Intermedica": "NotreDame Intermédica (GNDI)",
    "NotreDame Intermédica (GNDI)": "NotreDame Intermédica (GNDI)",
    "Omint": "Omint",
    "Plena": "Plena",
    "Porto Seguro": "Porto Seguro",
    "Prevent Senior": "Prevent Senior",
    "SulAmerica": "Sulamérica",
    "SulAmérica": "Sulamérica",
    "Sulamérica": "Sulamérica",
    "Unimed": "Unimed",
    "Outros": "Outros",
  };

  if (map[s]) return map[s];

  if (s.includes("|") || s.includes("/")) return "Outros";
  return null;
}

const ALLOWED_LEAD_STATUS = new Set([
  "new_opportunity",
  "scheduled",
  "no_show",
  "pricingRequest",
  "offerNegotiation",
  "pending_documents",
  "offerSubmission",
  "dps_agreement",
  "invoicePayment",
  "disqualified",
  "opportunityLost",
  "operator_denied",
  "contract_finalized",
]);

function mapStatus(v: string | null): string {
  if (!v) return "new_opportunity";
  const s = v.trim();
  return ALLOWED_LEAD_STATUS.has(s) ? s : "new_opportunity";
}

function findHeaderRowIndex(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row = matrix[i] || [];
    const joined = row.map((c) => String(c ?? "").toLowerCase()).join(" | ");
    if (
      joined.includes("task name") ||
      joined.includes("email") ||
      joined.includes("telefone") ||
      joined.includes("cnpj")
    ) {
      return i;
    }
  }
  return 0;
}

function loadRows(inputPath: string): Row[] {
  const wb = XLSX.readFile(inputPath, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];

  const headerIdx = findHeaderRowIndex(matrix);
  const headers = (matrix[headerIdx] || []).map((h) => String(h ?? "").trim());

  const rows: Row[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const line = matrix[r] || [];
    if (!line.some((c) => c !== null && c !== undefined && String(c).trim() !== "")) continue;

    const obj: Row = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = line[c];
    }
    rows.push(obj);
  }

  return rows;
}

function pick(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = toStr(row[k]);
    if (v) return v;
  }
  return null;
}

function buildLeadCode(name: string, idx1Based: number, yyyymmdd: string): string {
  const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const first = (clean[0] || "L").toUpperCase();
  const last = (clean[clean.length - 1] || "D").toUpperCase();
  const seq = String(idx1Based).padStart(4, "0");
  const rand = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${first}${yyyymmdd}${seq}${rand}${last}`;
}

function main() {
  const root = process.cwd();
  const candidates = [
    path.join(root, "leadsExternos.csv"),
    path.join(root, "leadsExternos.xlsx"),
    path.join(root, "leadsexternos.xlsx"),
    path.join(root, "leadsExternos.xls"),
    path.join(root, "leadsExternos.tsv"),
  ];

  const inputPath = candidates.find(fileExists);
  if (!inputPath) {
    console.error(
      `Arquivo de entrada não encontrado. Coloque "leadsExternos.csv" (ou .xlsx) na raiz do projeto.\nTentativas:\n- ${candidates.join(
        "\n- "
      )}`
    );
    process.exit(1);
  }

  const importStamp = new Date().toISOString();
  const yyyymmdd = importStamp.slice(0, 10).replace(/-/g, "");

  console.info(`[generate] Lendo: ${path.relative(root, inputPath)}`);
  const rows = loadRows(inputPath);
  console.info(`[generate] Linhas detectadas: ${rows.length}`);

  const outDir = path.join(root, "scripts");
  ensureDir(outDir);

  const outSqlPath = path.join(outDir, "backfill-import-leads.sql");
  const outMetaPath = path.join(outDir, "backfill-import-leads.meta.json");

  const meta: Array<Record<string, unknown>> = [];
  const sql: string[] = [];

  sql.push(`-- backfill-import-leads.sql`);
  sql.push(`-- generatedAt: ${importStamp}`);
  sql.push(`-- managerId/createdBy/updatedBy: ${MANAGER_PROFILE_ID}`);
  sql.push("");

  let produced = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idx = i + 1;

    const name = pick(row, ["Task Name", "Nome", "name"]);
    if (!name) {
      skipped++;
      console.info(`[generate] Linha ${idx} ignorada: nome ausente`);
      continue;
    }

    const leadId = randomUUID();
    const leadCode = buildLeadCode(name, idx, yyyymmdd);

    const email = normalizeEmail(pick(row, ["Email (email)", "Email", "email"]));
    const phone = digitsOnly(pick(row, ["Telefone (phone)", "Telefone", "phone"]));
    const cnpj = digitsOnly(pick(row, ["CNPJ (short text)", "CNPJ", "cnpj"]));
    const age = pick(row, ["Idades (short text)", "Idades", "age"]);

    const statusRaw = pick(row, ["Status", "status"]);
    const status = mapStatus(statusRaw);

    const planRaw = pick(row, [
      "Operadora (drop down)",
      "Operadora",
      "Qual o plano no Momento? (drop down)",
      "Qual o plano no Momento?",
    ]);
    const currentHealthPlanDb = mapHealthPlanToDbLabel(planRaw);

    const currentValue = parseCurrency(row["Valor Atual (currency)"] ?? row["Valor Atual"]);
    const ticket = parseCurrency(row["Ticket (currency)"] ?? row["Ticket"]);

    const referenceHospital = pick(row, [
      "Hospital Referência (Se houver) (short text)",
      "Hospital Referência",
      "referenceHospital",
    ]);

    const currentTreatment = pick(row, [
      "Existe algum tratamento que está no fazendo no momento? (short text)",
      "Tratamento",
      "currentTreatment",
    ]);

    const obs = pick(row, ["Observações Adicionais (text)", "Observações Adicionais", "notes"]);
    const taskContent = pick(row, ["Task Content", "Conteúdo", "content"]);

    const notesParts: string[] = [];
    notesParts.push(`Importado via backfill em ${importStamp}`);
    if (obs) notesParts.push(`Obs: ${obs}`);
    if (taskContent && taskContent !== "\\n") notesParts.push(`Content: ${taskContent}`);
    const notes = notesParts.join("\n\n");

    // IMPORTANTE:
    // - Inclui "id" explicitamente (porque no seu banco id não está defaultando uuid)
    // - assignedTo = managerId (pra não ir NULL)
    const stmt = [
      `INSERT INTO "leads" (`,
      `"id","leadCode","managerId","assignedTo","closerId","status","name","email","phone","cnpj","age","currentHealthPlan","currentValue","referenceHospital","currentTreatment","notes","ticket","contractDueDate","soldPlan","createdBy","updatedBy","createdAt","updatedAt"`,
      `) VALUES (`,
      [
        `'${leadId}'::uuid`,
        sqlTextOrNull(leadCode),
        `'${MANAGER_PROFILE_ID}'::uuid`,
        `'${MANAGER_PROFILE_ID}'::uuid`, // <- não NULL
        `NULL`,
        sqlTextOrNull(status),
        sqlTextOrNull(name),
        email ? sqlTextOrNull(email) : "NULL",
        phone ? sqlTextOrNull(phone) : "NULL",
        cnpj ? sqlTextOrNull(cnpj) : "NULL",
        age ? sqlTextOrNull(age) : "NULL",
        currentHealthPlanDb ? sqlTextOrNull(currentHealthPlanDb) : "NULL",
        currentValue ? currentValue : "NULL",
        referenceHospital ? sqlTextOrNull(referenceHospital) : "NULL",
        currentTreatment ? sqlTextOrNull(currentTreatment) : "NULL",
        notes ? sqlTextOrNull(notes) : "NULL",
        ticket ? ticket : "NULL",
        "NULL",
        "NULL",
        `'${MANAGER_PROFILE_ID}'::uuid`,
        `'${MANAGER_PROFILE_ID}'::uuid`,
        "NOW()",
        "NOW()",
      ].join(","),
      `) ON CONFLICT DO NOTHING;`,
    ].join("\n");

    sql.push(`-- row ${idx}: ${name}${email ? ` | ${email}` : ""}${phone ? ` | ${phone}` : ""}`);
    sql.push(stmt);
    sql.push("");

    meta.push({
      row: idx,
      id: leadId,
      leadCode,
      name,
      email,
      phone,
      cnpj,
      status,
      currentHealthPlan: currentHealthPlanDb,
      currentValue,
      ticket,
      assignedTo: MANAGER_PROFILE_ID,
      managerId: MANAGER_PROFILE_ID,
    });

    produced++;
  }

  fs.writeFileSync(outSqlPath, sql.join("\n"), "utf-8");
  fs.writeFileSync(outMetaPath, JSON.stringify(meta, null, 2), "utf-8");

  console.info(`[generate] SQL gerado: ${path.relative(root, outSqlPath)}`);
  console.info(`[generate] META gerado: ${path.relative(root, outMetaPath)}`);
  console.info(`[generate] Leads gerados: ${produced}`);
  console.info(`[generate] Linhas ignoradas (sem nome): ${skipped}`);
}

main();
