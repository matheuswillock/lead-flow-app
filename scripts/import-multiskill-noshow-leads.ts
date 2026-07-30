import fs from "node:fs";
import path from "node:path";
import {
  ActivityType,
  LeadOriginChannel,
  LeadStatus,
  PrismaClient,
} from "@prisma/client";
import { MULTISKILL_TEAM_NAME } from "../lib/multiskill/constants";
import { readXlsxRowsFromFile } from "../lib/spreadsheet/readXlsxRows";

const prisma = new PrismaClient();

const MULTISKILL_TEAM_ID = "7b577c22-5513-42cc-ab19-2bf867e14ebc";
const BRUNO_PROFILE_ID = "0c96a57e-6cc1-400f-bf3a-5740b699ac21";
const SDR_POOL = [
  "d97f16a7-e2f6-4194-9425-f82d793e73ce", // Debora Taytson
  "4ad47884-7b56-46c7-ac22-7b8285267140", // Thuane Marciano
  "bcfd95e5-293e-46d0-a33b-406bf7824b07", // Maria Eduarda
] as const;

const DEFAULT_INPUT_FILE =
  "Leads_NoShow_Select01_Select03_ClasseAlta.xlsx";

type ParsedLeadRow = {
  rowNumber: number;
  name: string;
  email: string | null;
  phone: string | null;
  currentHealthPlan: string | null;
  currentValue: number | null;
  notes: string | null;
  originalCode: string | null;
  sourceTeam: string | null;
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
  failed: number;
};

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

  if (normalized.includes("intermedica") || normalized.includes("gndi"))
    return "NotreDame Intermédica (GNDI)";
  if (normalized.includes("bradesco")) return "Bradesco";
  if (normalized.includes("amil")) return "Amil";
  if (normalized.includes("hapvida")) return "Hapvida";
  if (normalized.includes("medsenior") || normalized.includes("med senior"))
    return "MedSênior";
  if (normalized.includes("omint")) return "Omint";
  if (normalized.includes("plena")) return "Plena";
  if (normalized.includes("porto seguro") || normalized.includes("porto"))
    return "Porto Seguro";
  if (normalized.includes("prevent senior")) return "Prevent Senior";
  if (normalized.includes("sulamerica") || normalized.includes("sul america"))
    return "SulAmérica";
  if (normalized.includes("unimed")) return "Unimed";
  if (normalized.includes("nova adesao")) return "Nova Adesão";
  if (normalized.includes("outros")) return "Outros";

  return null;
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

function buildNotes(notesRaw: string | null, followUpNotesRaw: string | null) {
  const parts: string[] = [];
  if (notesRaw) parts.push(notesRaw);
  if (followUpNotesRaw) parts.push(followUpNotesRaw);
  if (!parts.length) return null;
  return parts.join("\n\n");
}

function buildLeadCodeBase(name: string) {
  const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const firstLetter = (clean[0] || "L").toUpperCase();
  const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();
  const digitsLength = 4 + Math.floor(Math.random() * 3);
  const digits = Array.from({ length: digitsLength }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
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

function appendErrorJsonl(
  errorsPath: string,
  payload: Record<string, unknown>
) {
  fs.appendFileSync(
    errorsPath,
    `${JSON.stringify({ at: nowIso(), ...payload })}\n`,
    "utf-8"
  );
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
    console.error(
      "Refusing to run without confirmation. Use --confirm (or --dry-run)."
    );
    process.exit(1);
  }

  return {
    dryRun,
    confirm,
    inputPath,
  };
}

async function preValidate() {
  const team = await prisma.team.findFirst({
    where: {
      id: MULTISKILL_TEAM_ID,
      name: MULTISKILL_TEAM_NAME,
      deletedAt: null,
    },
    select: { id: true, name: true, masterId: true },
  });

  if (!team) {
    throw new Error(
      `Team not found: ${MULTISKILL_TEAM_ID} (${MULTISKILL_TEAM_NAME})`
    );
  }

  if (team.masterId !== BRUNO_PROFILE_ID) {
    throw new Error(
      `Team masterId mismatch. Expected ${BRUNO_PROFILE_ID}, got ${team.masterId}`
    );
  }

  const bruno = await prisma.profile.findUnique({
    where: { id: BRUNO_PROFILE_ID },
    select: { id: true, fullName: true, email: true, isMaster: true },
  });

  if (!bruno) {
    throw new Error(`Bruno profile not found: ${BRUNO_PROFILE_ID}`);
  }

  const sdrProfiles = await prisma.profile.findMany({
    where: { id: { in: [...SDR_POOL] } },
    select: { id: true, fullName: true, email: true },
  });

  if (sdrProfiles.length !== SDR_POOL.length) {
    const found = new Set(sdrProfiles.map((p) => p.id));
    const missing = SDR_POOL.filter((id) => !found.has(id));
    throw new Error(`SDR profiles not found: ${missing.join(", ")}`);
  }

  const memberships = await prisma.teamMember.findMany({
    where: {
      teamId: MULTISKILL_TEAM_ID,
      profileId: { in: [...SDR_POOL] },
    },
    select: { profileId: true },
  });

  const membershipIds = new Set(memberships.map((m) => m.profileId));
  const missingMemberships = SDR_POOL.filter((id) => !membershipIds.has(id));
  if (missingMemberships.length) {
    throw new Error(
      `SDRs not members of MultiSkill: ${missingMemberships.join(", ")}`
    );
  }

  console.info("[import-multiskill] Team:", team.id, team.name);
  console.info("[import-multiskill] Master:", bruno.fullName, bruno.email);
  console.info(
    "[import-multiskill] SDRs:",
    sdrProfiles.map((p) => `${p.fullName} <${p.email}>`).join("; ")
  );

  return { team, bruno };
}

async function parseSheetRows(inputPath: string): Promise<{
  parsedRows: ParsedLeadRow[];
  skippedMissingName: number;
}> {
  const rows = await readXlsxRowsFromFile(inputPath);
  if (!rows.length) {
    throw new Error("Spreadsheet is empty.");
  }

  const headerMap = buildHeaderMap(rows[0]);
  const hasNome = headerMap.has("nome");
  if (!hasNome) {
    throw new Error("Export header not found (expected column Nome).");
  }

  const parsedRows: ParsedLeadRow[] = [];
  let skippedMissingName = 0;

  rows.slice(1).forEach((row, idx) => {
    const rowNumber = idx + 2;
    const name = getCell(row, headerMap, "Nome");
    if (!name) {
      skippedMissingName += 1;
      return;
    }

    const emailRaw = getCell(row, headerMap, "Email");
    const phoneRaw = getCell(row, headerMap, "Telefone");
    const planRaw = getCell(row, headerMap, "Plano Atual");
    const valueRaw = getCell(row, headerMap, "Valor Atual (R$)");
    const notesRaw = getCell(row, headerMap, "Notas");
    const followUpNotesRaw = getCell(row, headerMap, "Notas de Follow Up");
    const originalCode = getCell(row, headerMap, "Código") || null;
    const sourceTeam = getCell(row, headerMap, "Time") || null;

    parsedRows.push({
      rowNumber,
      name,
      email: emailRaw ? normalizeEmail(emailRaw) : null,
      phone: phoneRaw ? normalizeDigits(phoneRaw) : null,
      currentHealthPlan: mapHealthPlan(planRaw || null),
      currentValue: parseCurrency(valueRaw) ?? null,
      notes: buildNotes(notesRaw || null, followUpNotesRaw || null),
      originalCode,
      sourceTeam,
    });
  });

  return { parsedRows, skippedMissingName };
}

async function loadExistingEmails(parsedRows: ParsedLeadRow[]) {
  const emailSet = new Set<string>();
  parsedRows.forEach((row) => {
    if (row.email) emailSet.add(row.email);
  });

  const existingLeads =
    emailSet.size > 0
      ? await prisma.lead.findMany({
          where: {
            teamId: MULTISKILL_TEAM_ID,
            email: { in: Array.from(emailSet) },
          },
          select: { id: true, email: true },
        })
      : [];

  const byEmail = new Map<string, string>();
  existingLeads.forEach((lead) => {
    if (lead.email) byEmail.set(normalizeEmail(lead.email), lead.id);
  });

  return byEmail;
}

async function run() {
  const root = process.cwd();
  const args = parseCliArgs();

  const scriptsDir = path.join(root, "scripts");
  const logPath = path.join(scriptsDir, "import-multiskill-noshow-leads.log");
  const errorsPath = path.join(
    scriptsDir,
    "import-multiskill-noshow-leads.errors.jsonl"
  );

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    errorsPath,
    `${JSON.stringify({
      at: nowIso(),
      event: "start",
      teamId: MULTISKILL_TEAM_ID,
      masterProfileId: BRUNO_PROFILE_ID,
      sdrPool: SDR_POOL,
      dryRun: args.dryRun,
      confirm: args.confirm,
      inputPath: args.inputPath,
    })}\n`,
    "utf-8"
  );

  appendLog(logPath, "--- START import-multiskill-noshow-leads ---");
  appendLog(logPath, `Mode dryRun=${args.dryRun} confirm=${args.confirm}`);
  appendLog(logPath, `Input ${args.inputPath}`);
  console.info(
    `[import-multiskill] START dryRun=${args.dryRun} confirm=${args.confirm}`
  );
  console.info(`[import-multiskill] Input: ${args.inputPath}`);

  const counters: Counters = {
    parsedRows: 0,
    skippedMissingName: 0,
    created: 0,
    skippedDuplicate: 0,
    failed: 0,
  };

  try {
    if (!fs.existsSync(args.inputPath)) {
      throw new Error(`Input file not found: ${args.inputPath}`);
    }

    await preValidate();

    const { parsedRows, skippedMissingName } = await parseSheetRows(
      args.inputPath
    );
    counters.parsedRows = parsedRows.length;
    counters.skippedMissingName = skippedMissingName;

    const existingByEmail = await loadExistingEmails(parsedRows);

    let sdrIndex = 0;
    const nextSdr = () => {
      const profileId = SDR_POOL[sdrIndex % SDR_POOL.length];
      sdrIndex += 1;
      return profileId;
    };

    for (const row of parsedRows) {
      const email = row.email;

      if (email && existingByEmail.has(email)) {
        counters.skippedDuplicate += 1;
        appendLog(
          logPath,
          `SKIP duplicate row=${row.rowNumber} email="${email}" name="${row.name}"`
        );
        continue;
      }

      const assignedTo = nextSdr();

      try {
        const leadCode = await generateUniqueLeadCode(row.name);

        if (args.dryRun) {
          counters.created += 1;
          if (email) existingByEmail.set(email, `dry-run-row-${row.rowNumber}`);
          appendLog(
            logPath,
            `DRY_RUN create row=${row.rowNumber} leadCode=${leadCode} assignedTo=${assignedTo} closerId=${BRUNO_PROFILE_ID}`
          );
          continue;
        }

        const createdLead = await prisma.lead.create({
          data: {
            leadCode,
            status: LeadStatus.new_opportunity,
            manager: { connect: { id: BRUNO_PROFILE_ID } },
            team: { connect: { id: MULTISKILL_TEAM_ID } },
            assignee: { connect: { id: assignedTo } },
            closer: { connect: { id: BRUNO_PROFILE_ID } },
            creator: { connect: { id: BRUNO_PROFILE_ID } },
            updater: { connect: { id: BRUNO_PROFILE_ID } },
            name: row.name,
            email: email || null,
            phone: row.phone || null,
            currentHealthPlan: row.currentHealthPlan || null,
            currentValue: row.currentValue ?? null,
            notes: row.notes || null,
            originChannel: LeadOriginChannel.csv_import,
            isTransfer: true,
            meetingDate: null,
            meetingTitle: null,
            meetingNotes: null,
            meetingLink: null,
            meetingType: null,
            meetingPresenceConfirmed: false,
            meetingPresenceConfirmedAt: null,
            followUpAt: null,
            followUpNotes: null,
            followUpSourceStatus: null,
            activities: {
              create: {
                type: ActivityType.note,
                body: "Lead importado via script MultiSkill NoShow",
                payload: {
                  source: "import-multiskill-noshow-leads.ts",
                  originalCode: row.originalCode ?? null,
                  sourceTeam: row.sourceTeam ?? null,
                  rowNumber: row.rowNumber,
                },
                author: { connect: { id: BRUNO_PROFILE_ID } },
              },
            },
          },
          select: { id: true },
        });

        counters.created += 1;
        if (email) existingByEmail.set(email, createdLead.id);

        appendLog(
          logPath,
          `OK create row=${row.rowNumber} leadId=${createdLead.id} assignedTo=${assignedTo}`
        );
      } catch (error) {
        counters.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[import-multiskill] ERROR row=${row.rowNumber} name="${row.name}" -> ${message}`
        );
        appendLog(
          logPath,
          `ERROR row=${row.rowNumber} name="${row.name}" -> ${message}`
        );
        appendErrorJsonl(errorsPath, {
          event: "row_error",
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          message,
        });
      }
    }

    const summary = {
      parsedRows: counters.parsedRows,
      skippedMissingName: counters.skippedMissingName,
      created: counters.created,
      skippedDuplicate: counters.skippedDuplicate,
      failed: counters.failed,
      dryRun: args.dryRun,
    };

    appendLog(logPath, `SUMMARY ${JSON.stringify(summary)}`);
    console.info("[import-multiskill] SUMMARY", summary);

    if (counters.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendLog(logPath, `FATAL ${message}`);
    appendErrorJsonl(errorsPath, { event: "fatal", message });
    console.error("[import-multiskill] FATAL:", message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    appendLog(logPath, "--- END import-multiskill-noshow-leads ---");
  }
}

run().catch(async (error) => {
  console.error("[import-multiskill] Unhandled error:", error);
  await prisma.$disconnect().catch(() => null);
  process.exit(1);
});
