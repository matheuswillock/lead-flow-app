import fs from "node:fs";
import path from "node:path";
import { PrismaClient, LeadStatus, ActivityType, UserRole } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

const TARGET_PROFILE_ID = "1b1cc33f-1aea-4877-bc53-ca49d52ee764";
const TARGET_TEAM_ID = "194a564d-d0f5-4a99-8985-258d6f8cc45d";
const DEFAULT_INPUT_FILE = "2026-01-23T01_41_42.565Z Onside Ltda - Backstage Club - Select - Outbound (1).xlsx";

type TeamMemberSeed = {
  id: string;
  teamId: string;
  profileId: string;
  role: UserRole;
  functions: string;
  createdAt: string;
  updatedAt: string;
};

const TEAM_MEMBERS: TeamMemberSeed[] = [
  {
    id: "13fe684c-d959-494b-bc33-cfd101c31801",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "c31d51be-0ced-418c-b353-026cb667a864",
    role: "manager",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 11:00:44.318+00",
    updatedAt: "2026-03-03 11:00:44.318+00",
  },
  {
    id: "2640aed9-baba-4093-a3b0-0b85ccbe8555",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "1b1cc33f-1aea-4877-bc53-ca49d52ee764",
    role: "manager",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 10:57:43.347+00",
    updatedAt: "2026-03-03 10:57:43.347+00",
  },
  {
    id: "69da715b-f2c8-4c79-a0aa-b832fc7f1d41",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "35df9767-5413-4ddb-b360-4f3d585db38f",
    role: "operator",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 11:01:26.563+00",
    updatedAt: "2026-03-03 11:01:26.563+00",
  },
  {
    id: "6a02ef54-35fb-40bb-b15f-abbacdd9a9f5",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "05750ae8-e9bd-4635-8988-b042b3b83c40",
    role: "operator",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 11:02:01.42+00",
    updatedAt: "2026-03-03 11:02:01.42+00",
  },
  {
    id: "95e051f5-24de-4a12-bf10-9fa0d8e0312d",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "87daaaca-41f4-475e-9304-d23bb7f0085c",
    role: "operator",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 11:03:10.131+00",
    updatedAt: "2026-03-03 11:03:10.131+00",
  },
  {
    id: "c0ef0316-cb7a-4682-a912-426971a6fc51",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "26b6c2d6-6377-45ac-a760-9705984ac6f8",
    role: "manager",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 11:03:55.895+00",
    updatedAt: "2026-03-03 11:03:55.895+00",
  },
  {
    id: "ec5c7088-c62f-4b89-800b-7d206ad92d80",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "7d20b50d-819e-4f41-82bf-898511aab581",
    role: "manager",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 11:09:01.455+00",
    updatedAt: "2026-03-03 11:09:01.455+00",
  },
  {
    id: "fcaf3d91-5f6a-482c-a2be-11431e923bac",
    teamId: "194a564d-d0f5-4a99-8985-258d6f8cc45d",
    profileId: "84183a6a-71f1-48b5-a6a7-4b3ccbc7e16b",
    role: "operator",
    functions: "[\"SDR\",\"CLOSER\"]",
    createdAt: "2026-03-03 11:05:14.452+00",
    updatedAt: "2026-03-03 11:05:14.452+00",
  },
];

type ParsedLeadRow = {
  rowNumber: number;
  taskId: string | null;
  name: string;
  status: LeadStatus;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  age: string | null;
  currentHealthPlan: string | null;
  currentValue: number | null;
  ticket: number | null;
  referenceHospital: string | null;
  currentTreatment: string | null;
  notes: string | null;
  assigneeRaw: string | null;
  createdByRaw: string | null;
  statusRaw: string | null;
};

type ExistingLeadKey = {
  id: string;
  status: LeadStatus;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
};

type CliArgs = {
  dryRun: boolean;
  confirm: boolean;
  inputPath: string;
};

type Counters = {
  parsedRows: number;
  skippedMissingName: number;
  created: number;
  skippedDuplicate: number;
  sanitized: number;
  failed: number;
};

const ALLOWED_LOST_STATUS = new Set<LeadStatus>([LeadStatus.opportunityLost, LeadStatus.disqualified]);

const nowIso = () => new Date().toISOString();

function normalizeText(value: string) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function parseCurrency(value: string) {
  if (!value) return undefined;
  let cleanValue = value.replace(/[^\d.,-]/g, "");
  if (!cleanValue) return undefined;

  if (cleanValue.includes(",")) {
    cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
  } else if ((cleanValue.match(/\./g) || []).length > 1) {
    const parts = cleanValue.split(".");
    const lastPart = parts.pop();
    cleanValue = parts.join("") + "." + lastPart;
  }

  const parsed = Number.parseFloat(cleanValue);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function mapHealthPlan(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (normalized.includes("intermedica") || normalized.includes("gndi")) return "NotreDame Intermédica (GNDI)";
  if (normalized.includes("bradesco")) return "Bradesco";
  if (normalized.includes("amil")) return "Amil";
  if (normalized.includes("hapvida")) return "Hapvida";
  if (normalized.includes("medsenior") || normalized.includes("med senior")) return "MedSênior";
  if (normalized.includes("omint")) return "Omint";
  if (normalized.includes("plena")) return "Plena";
  if (normalized.includes("porto seguro") || normalized.includes("porto")) return "Porto Seguro";
  if (normalized.includes("prevent senior")) return "Prevent Senior";
  if (normalized.includes("sulamerica") || normalized.includes("sul america")) return "SulAmérica";
  if (normalized.includes("unimed")) return "Unimed";
  if (normalized.includes("nova adesao")) return "Nova Adesão";
  if (normalized.includes("outros")) return "Outros";

  return null;
}

function mapStatus(value: string | null | undefined): LeadStatus {
  if (!value) return LeadStatus.new_opportunity;
  const normalized = normalizeText(value);

  if (normalized === "contract_finalized" || normalized === "contract finalized") {
    return LeadStatus.contract_finalized;
  }
  if (normalized === "agendado") return LeadStatus.scheduled;
  if (normalized === "negociacao") return LeadStatus.offerNegotiation;
  if (normalized === "pendente") return LeadStatus.pending_documents;
  if (normalized === "doctos pendentes") return LeadStatus.pending_documents;
  if (normalized === "implementacao enviada") return LeadStatus.offerSubmission;
  if (normalized === "venda futura") return LeadStatus.offerSubmission;

  if (normalized.includes("perdido")) return LeadStatus.opportunityLost;
  if (normalized.includes("desqualificado")) return LeadStatus.disqualified;
  if (normalized.includes("negado")) return LeadStatus.operator_denied;
  if (normalized.includes("no show")) return LeadStatus.no_show;
  if (normalized.includes("agend")) return LeadStatus.scheduled;
  if (normalized.includes("cotacao")) return LeadStatus.pricingRequest;
  if (normalized.includes("negoci")) return LeadStatus.offerNegotiation;
  if (normalized.includes("document")) return LeadStatus.pending_documents;
  if (normalized.includes("proposta")) return LeadStatus.offerSubmission;
  if (
    normalized.includes("negocio fechado") ||
    (normalized.includes("negocio") && normalized.includes("fechado")) ||
    normalized.includes("contrato assinado") ||
    normalized.includes("contrato fechado") ||
    normalized.includes("venda concluida") ||
    normalized.includes("fechado") ||
    normalized.includes("finalizado")
  ) {
    return LeadStatus.contract_finalized;
  }
  if (normalized.includes("dps") || normalized.includes("contrato")) return LeadStatus.dps_agreement;
  if (normalized.includes("boleto") || normalized.includes("fatura")) return LeadStatus.invoicePayment;

  return LeadStatus.new_opportunity;
}

function findHeaderIndex(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeText(String(cell ?? "")));
    return normalized.includes("task id") && normalized.includes("task name");
  });
}

function buildHeaderMap(headers: unknown[]) {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalized = normalizeText(String(header ?? ""));
    if (normalized) {
      map.set(normalized, index);
    }
  });
  return map;
}

function getCell(row: unknown[], headerMap: Map<string, number>, header: string) {
  const normalizedHeader = normalizeText(header);
  const idx = headerMap.get(normalizedHeader);
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
}

function buildLeadCodeBase(name: string) {
  const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const firstLetter = (clean[0] || "L").toUpperCase();
  const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();
  const digitsLength = 4 + Math.floor(Math.random() * 3);
  const digits = Array.from({ length: digitsLength }, () => Math.floor(Math.random() * 10)).join("");
  return `${firstLetter}${digits}${lastLetter}`;
}

async function generateUniqueLeadCode(name: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = buildLeadCodeBase(name);
    const existing = await prisma.lead.findUnique({
      where: { leadCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }

  const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const firstLetter = (clean[0] || "L").toUpperCase();
  const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();
  const fallbackDigits = Date.now().toString().slice(-6);
  return `${firstLetter}${fallbackDigits}${lastLetter}`;
}

function appendLog(logPath: string, line: string) {
  fs.appendFileSync(logPath, `[${nowIso()}] ${line}\n`, "utf-8");
}

function appendErrorJsonl(errorsPath: string, payload: Record<string, unknown>) {
  fs.appendFileSync(errorsPath, `${JSON.stringify({ at: nowIso(), ...payload })}\n`, "utf-8");
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const confirm = args.includes("--confirm");
  const fileArg = args.find((arg) => arg.startsWith("--file="));
  const inputPath = fileArg
    ? path.resolve(process.cwd(), fileArg.slice("--file=".length))
    : path.join(process.cwd(), DEFAULT_INPUT_FILE);

  if (!dryRun && !confirm) {
    console.error("Refusing to run without confirmation. Use --confirm (or --dry-run).");
    process.exit(1);
  }

  return {
    dryRun,
    confirm,
    inputPath,
  };
}

function buildNotes(parts: {
  notesRaw: string | null;
  taskContentRaw: string | null;
  assigneeRaw: string | null;
  createdByRaw: string | null;
  taskId: string | null;
  statusRaw: string | null;
  rowNumber: number;
}) {
  const chunks: string[] = [];
  if (parts.notesRaw) chunks.push(parts.notesRaw);
  if (parts.taskContentRaw && parts.taskContentRaw !== "\\n") chunks.push(`Task Content: ${parts.taskContentRaw}`);
  chunks.push(
    [
      "Import metadata",
      `row=${parts.rowNumber}`,
      `taskId=${parts.taskId ?? ""}`,
      `assigneeRaw=${parts.assigneeRaw ?? ""}`,
      `createdByRaw=${parts.createdByRaw ?? ""}`,
      `statusRaw=${parts.statusRaw ?? ""}`,
    ].join(" | ")
  );
  return chunks.join("\n\n");
}

function isLostStatus(status: LeadStatus | null | undefined) {
  return !!status && ALLOWED_LOST_STATUS.has(status);
}

async function preValidate(inputPath: string) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const invalidTeamMembers = TEAM_MEMBERS.filter((member) => member.teamId !== TARGET_TEAM_ID);
  if (invalidTeamMembers.length > 0) {
    throw new Error("TEAM_MEMBERS contains rows from a different teamId.");
  }

  const operatorPool = TEAM_MEMBERS.filter((member) => member.role === "operator").map((member) => member.profileId);
  const managerPool = TEAM_MEMBERS.filter((member) => member.role === "manager").map((member) => member.profileId);

  if (!operatorPool.length) {
    throw new Error("TEAM_MEMBERS must contain at least one operator.");
  }

  if (!managerPool.length) {
    throw new Error("TEAM_MEMBERS must contain at least one manager.");
  }

  const duplicatedProfiles = TEAM_MEMBERS.map((member) => member.profileId).filter(
    (id, idx, arr) => arr.indexOf(id) !== idx
  );
  if (duplicatedProfiles.length > 0) {
    throw new Error(`TEAM_MEMBERS has duplicated profileId entries: ${duplicatedProfiles.join(", ")}`);
  }

  const [targetProfile, team, membership] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: TARGET_PROFILE_ID },
      select: { id: true, activeTeamId: true },
    }),
    prisma.team.findUnique({
      where: { id: TARGET_TEAM_ID },
      select: { id: true, masterId: true },
    }),
    prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId: TARGET_TEAM_ID,
          profileId: TARGET_PROFILE_ID,
        },
      },
      select: { id: true },
    }),
  ]);

  if (!targetProfile) {
    throw new Error(`Target profile not found: ${TARGET_PROFILE_ID}`);
  }

  if (targetProfile.activeTeamId !== TARGET_TEAM_ID) {
    throw new Error(
      `Target profile activeTeamId mismatch. Expected ${TARGET_TEAM_ID}, got ${targetProfile.activeTeamId ?? "null"}`
    );
  }

  if (!team) {
    throw new Error(`Target team not found: ${TARGET_TEAM_ID}`);
  }

  if (team.masterId !== TARGET_PROFILE_ID) {
    throw new Error(`Target team masterId mismatch. Expected ${TARGET_PROFILE_ID}, got ${team.masterId}`);
  }

  if (!membership) {
    throw new Error(`Target profile ${TARGET_PROFILE_ID} is not a member of team ${TARGET_TEAM_ID}`);
  }

  return {
    operatorPool,
    managerPool,
  };
}

function parseSheetRows(inputPath: string): { parsedRows: ParsedLeadRow[]; skippedMissingName: number } {
  const workbook = XLSX.readFile(inputPath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error("Sheet not found in workbook.");
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const headerIndex = findHeaderIndex(rows);
  if (headerIndex === -1) {
    throw new Error("ClickUp header not found (Task ID + Task Name).");
  }

  const headerMap = buildHeaderMap(rows[headerIndex]);
  const dataRows = rows.slice(headerIndex + 1);
  const parsedRows: ParsedLeadRow[] = [];
  let skippedMissingName = 0;

  dataRows.forEach((row, idx) => {
    const rowNumber = headerIndex + 2 + idx;
    const name = getCell(row, headerMap, "Task Name");
    if (!name) {
      skippedMissingName += 1;
      return;
    }

    const emailRaw = getCell(row, headerMap, "Email (email)");
    const phoneRaw = getCell(row, headerMap, "Telefone (phone)");
    const cnpjRaw = getCell(row, headerMap, "CNPJ (short text)");
    const statusRaw = getCell(row, headerMap, "Status");
    const taskContentRaw = getCell(row, headerMap, "Task Content");
    const notesRaw = getCell(row, headerMap, "Observações Adicionais (text)");
    const assigneeRaw = getCell(row, headerMap, "Assignee");
    const createdByRaw = getCell(row, headerMap, "Created By");
    const taskId = getCell(row, headerMap, "Task ID") || null;

    const planValue =
      getCell(row, headerMap, "Qual o plano no Momento? (drop down)") ||
      getCell(row, headerMap, "Operadora (drop down)");

    const notes = buildNotes({
      notesRaw: notesRaw || null,
      taskContentRaw: taskContentRaw || null,
      assigneeRaw: assigneeRaw || null,
      createdByRaw: createdByRaw || null,
      taskId,
      statusRaw: statusRaw || null,
      rowNumber,
    });

    parsedRows.push({
      rowNumber,
      taskId,
      name,
      status: mapStatus(statusRaw),
      email: emailRaw ? normalizeEmail(emailRaw) : null,
      phone: phoneRaw ? normalizeDigits(phoneRaw) : null,
      cnpj: cnpjRaw ? normalizeDigits(cnpjRaw) : null,
      age: getCell(row, headerMap, "Idades (short text)") || null,
      currentHealthPlan: mapHealthPlan(planValue || null),
      currentValue: parseCurrency(getCell(row, headerMap, "Valor Atual (currency)")) ?? null,
      ticket: parseCurrency(getCell(row, headerMap, "Ticket (currency)")) ?? null,
      referenceHospital: getCell(row, headerMap, "Hospital Referência (Se houver) (short text)") || null,
      currentTreatment:
        getCell(row, headerMap, "Existe algum tratamento que está no fazendo no momento? (short text)") || null,
      notes: notes || null,
      assigneeRaw: assigneeRaw || null,
      createdByRaw: createdByRaw || null,
      statusRaw: statusRaw || null,
    });
  });

  return { parsedRows, skippedMissingName };
}

async function loadExistingLeadMaps(parsedRows: ParsedLeadRow[]) {
  const emailSet = new Set<string>();
  const cnpjSet = new Set<string>();

  parsedRows.forEach((row) => {
    if (row.email) emailSet.add(row.email);
    if (row.cnpj) cnpjSet.add(row.cnpj);
  });

  const existingLeads =
    emailSet.size || cnpjSet.size
      ? await prisma.lead.findMany({
          where: {
            teamId: TARGET_TEAM_ID,
            OR: [
              emailSet.size ? { email: { in: Array.from(emailSet) } } : undefined,
              cnpjSet.size ? { cnpj: { in: Array.from(cnpjSet) } } : undefined,
            ].filter(Boolean) as Array<{ email?: { in: string[] }; cnpj?: { in: string[] } }>,
          },
          select: {
            id: true,
            email: true,
            phone: true,
            cnpj: true,
            status: true,
          },
        })
      : [];

  const byEmail = new Map<string, ExistingLeadKey>();
  const byCnpj = new Map<string, ExistingLeadKey>();

  existingLeads.forEach((lead) => {
    const normalizedEmail = lead.email ? normalizeEmail(lead.email) : null;
    const normalizedCnpj = lead.cnpj ? normalizeDigits(lead.cnpj) : null;
    if (normalizedEmail) byEmail.set(normalizedEmail, lead);
    if (normalizedCnpj) byCnpj.set(normalizedCnpj, lead);
  });

  return { byEmail, byCnpj };
}

async function run() {
  const root = process.cwd();
  const args = parseCliArgs();

  const scriptsDir = path.join(root, "scripts");
  const logPath = path.join(scriptsDir, "import-onside-backstage-leads.log");
  const errorsPath = path.join(scriptsDir, "import-onside-backstage-leads.errors.jsonl");

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    errorsPath,
    `${JSON.stringify({
      at: nowIso(),
      event: "start",
      targetProfileId: TARGET_PROFILE_ID,
      targetTeamId: TARGET_TEAM_ID,
      dryRun: args.dryRun,
      confirm: args.confirm,
      inputPath: args.inputPath,
    })}\n`,
    "utf-8"
  );

  appendLog(logPath, "--- START import-onside-backstage-leads ---");
  appendLog(logPath, `Mode dryRun=${args.dryRun} confirm=${args.confirm}`);
  appendLog(logPath, `Input ${args.inputPath}`);
  console.info(`[import-onside] START dryRun=${args.dryRun} confirm=${args.confirm}`);
  console.info(`[import-onside] Input: ${args.inputPath}`);

  const counters: Counters = {
    parsedRows: 0,
    skippedMissingName: 0,
    created: 0,
    skippedDuplicate: 0,
    sanitized: 0,
    failed: 0,
  };

  try {
    const pools = await preValidate(args.inputPath);

    const { parsedRows, skippedMissingName } = parseSheetRows(args.inputPath);
    counters.parsedRows = parsedRows.length;
    counters.skippedMissingName = skippedMissingName;

    const existingMaps = await loadExistingLeadMaps(parsedRows);

    let operatorIndex = 0;
    let managerIndex = 0;

    const nextAssignedTo = () => {
      if (!pools.operatorPool.length) return TARGET_PROFILE_ID;
      const profileId = pools.operatorPool[operatorIndex % pools.operatorPool.length];
      operatorIndex += 1;
      return profileId;
    };

    const nextCloserId = () => {
      if (!pools.managerPool.length) return TARGET_PROFILE_ID;
      const profileId = pools.managerPool[managerIndex % pools.managerPool.length];
      managerIndex += 1;
      return profileId;
    };

    for (const row of parsedRows) {
      let email = row.email;
      const phone = row.phone;
      let cnpj = row.cnpj;

      const emailConflict = email ? existingMaps.byEmail.get(email) ?? null : null;
      const cnpjConflict = cnpj ? existingMaps.byCnpj.get(cnpj) ?? null : null;

      const canReuseEmail = emailConflict && isLostStatus(emailConflict.status) && isLostStatus(row.status);
      const canReuseCnpj = cnpjConflict && isLostStatus(cnpjConflict.status) && isLostStatus(row.status);

      if ((emailConflict && !canReuseEmail) || (cnpjConflict && !canReuseCnpj)) {
        counters.skippedDuplicate += 1;
        appendLog(logPath, `SKIP duplicate row=${row.rowNumber} name="${row.name}"`);
        continue;
      }

      if (emailConflict && canReuseEmail) {
        email = null;
        counters.sanitized += 1;
      }
      if (cnpjConflict && canReuseCnpj) {
        cnpj = null;
        counters.sanitized += 1;
      }

      const assignedTo = nextAssignedTo();
      const closerId = nextCloserId();

      try {
        const leadCode = await generateUniqueLeadCode(row.name);

        if (args.dryRun) {
          counters.created += 1;
          if (email) {
            existingMaps.byEmail.set(email, {
              id: `dry-run-row-${row.rowNumber}`,
              email,
              phone,
              cnpj,
              status: row.status,
            });
          }
          if (cnpj) {
            existingMaps.byCnpj.set(cnpj, {
              id: `dry-run-row-${row.rowNumber}`,
              email,
              phone,
              cnpj,
              status: row.status,
            });
          }
          appendLog(
            logPath,
            `DRY_RUN create row=${row.rowNumber} leadCode=${leadCode} assignedTo=${assignedTo} closerId=${closerId}`
          );
          continue;
        }

        const createdLead = await prisma.$transaction(async (tx) => {
          const lead = await tx.lead.create({
            data: {
              leadCode,
              manager: { connect: { id: TARGET_PROFILE_ID } },
              team: { connect: { id: TARGET_TEAM_ID } },
              assignee: { connect: { id: assignedTo } },
              closer: { connect: { id: closerId } },
              creator: { connect: { id: TARGET_PROFILE_ID } },
              updater: { connect: { id: TARGET_PROFILE_ID } },
              status: row.status,
              name: row.name,
              email: email || null,
              phone: phone || null,
              cnpj: cnpj || null,
              age: row.age || null,
              currentHealthPlan: row.currentHealthPlan || null,
              currentValue: row.currentValue ?? null,
              referenceHospital: row.referenceHospital || null,
              currentTreatment: row.currentTreatment || null,
              notes: row.notes || null,
              ticket: row.ticket ?? null,
              contractDueDate: null,
              soldPlan: null,
              activities: {
                create: {
                  type: ActivityType.note,
                  body: "Lead importado via script local",
                  payload: {
                    source: "import-onside-backstage-leads.ts",
                    rowNumber: row.rowNumber,
                    taskId: row.taskId ?? null,
                    assigneeRaw: row.assigneeRaw ?? null,
                    createdByRaw: row.createdByRaw ?? null,
                    statusRaw: row.statusRaw ?? null,
                  },
                  author: { connect: { id: TARGET_PROFILE_ID } },
                },
              },
            },
            select: {
              id: true,
              createdAt: true,
            },
          });

          if (row.status === LeadStatus.contract_finalized) {
            await tx.leadFinalized.create({
              data: {
                leadId: lead.id,
                finalizedDateAt: new Date(),
                startDateAt: lead.createdAt,
                duration: 0,
                amount: row.ticket ?? row.currentValue ?? 0,
                notes: "Lead importado como negócio fechado",
              },
            });
          }

          return lead;
        });

        counters.created += 1;
        if (email) existingMaps.byEmail.set(email, { id: createdLead.id, email, phone, cnpj, status: row.status });
        if (cnpj) existingMaps.byCnpj.set(cnpj, { id: createdLead.id, email, phone, cnpj, status: row.status });

        appendLog(
          logPath,
          `OK create row=${row.rowNumber} leadId=${createdLead.id} assignedTo=${assignedTo} closerId=${closerId}`
        );
      } catch (error) {
        counters.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[import-onside] ERROR row=${row.rowNumber} name="${row.name}" -> ${message}`);
        appendLog(logPath, `ERROR row=${row.rowNumber} name="${row.name}" -> ${message}`);
        appendErrorJsonl(errorsPath, {
          event: "row_error",
          rowNumber: row.rowNumber,
          taskId: row.taskId,
          name: row.name,
          message,
        });
      }
    }

    const summary = {
      parsedRows: counters.parsedRows,
      skippedMissingName: counters.skippedMissingName,
      created: counters.created,
      skippedDuplicate: counters.skippedDuplicate,
      sanitized: counters.sanitized,
      failed: counters.failed,
      dryRun: args.dryRun,
    };

    appendLog(logPath, `SUMMARY ${JSON.stringify(summary)}`);
    console.info("[import-onside] SUMMARY", summary);

    if (counters.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendLog(logPath, `FATAL ${message}`);
    appendErrorJsonl(errorsPath, {
      event: "fatal",
      message,
    });
    console.error("[import-onside] FATAL:", message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    appendLog(logPath, "--- END import-onside-backstage-leads ---");
  }
}

run().catch(async (error) => {
  console.error("[import-onside] Unhandled error:", error);
  await prisma.$disconnect().catch(() => null);
  process.exit(1);
});
