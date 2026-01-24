import { NextRequest, NextResponse } from "next/server";
import { LeadStatus, HealthPlan } from "@prisma/client";
import * as XLSX from "xlsx";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

const normalizeText = (value: string) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

const parseCurrency = (value: string) => {
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
};

const mapHealthPlan = (value: string | null | undefined): HealthPlan | null => {
  if (!value) return null;
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (normalized.includes("intermedica") || normalized.includes("gndi")) return HealthPlan.GNDI;
  if (normalized.includes("bradesco")) return HealthPlan.BRADESCO;
  if (normalized.includes("amil")) return HealthPlan.AMIL;
  if (normalized.includes("hapvida")) return HealthPlan.HAPVIDA;
  if (normalized.includes("medsenior") || normalized.includes("med senior")) return HealthPlan.MEDSENIOR;
  if (normalized.includes("omint")) return HealthPlan.OMINT;
  if (normalized.includes("plena")) return HealthPlan.PLENA;
  if (normalized.includes("porto seguro") || normalized.includes("porto")) return HealthPlan.PORTO_SEGURO;
  if (normalized.includes("prevent senior")) return HealthPlan.PREVENT_SENIOR;
  if (normalized.includes("sulamerica") || normalized.includes("sul america")) return HealthPlan.SULAMERICA;
  if (normalized.includes("unimed")) return HealthPlan.UNIMED;
  if (normalized.includes("nova adesao")) return HealthPlan.NOVA_ADESAO;
  if (normalized.includes("outros")) return HealthPlan.OUTROS;

  return null;
};

const mapStatus = (value: string | null | undefined): LeadStatus => {
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
  if (normalized.includes("cotacao") || normalized.includes("cotacao")) return LeadStatus.pricingRequest;
  if (normalized.includes("negoci")) return LeadStatus.offerNegotiation;
  if (normalized.includes("document")) return LeadStatus.pending_documents;
  if (normalized.includes("proposta")) return LeadStatus.offerSubmission;
  if (
    normalized.includes("negocio fechado") ||
    normalized.includes("negocio") && normalized.includes("fechado") ||
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
};

const isLostStatus = (status: LeadStatus | null | undefined) =>
  status === LeadStatus.opportunityLost || status === LeadStatus.disqualified;

const findHeaderIndex = (rows: unknown[][]) =>
  rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeText(String(cell ?? "")));
    return normalized.includes("task id") && normalized.includes("task name");
  });

const buildHeaderMap = (headers: unknown[]) => {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalized = normalizeText(String(header ?? ""));
    if (normalized) {
      map.set(normalized, index);
    }
  });
  return map;
};

const getCell = (row: unknown[], headerMap: Map<string, number>, header: string) => {
  const normalizedHeader = normalizeText(header);
  const idx = headerMap.get(normalizedHeader);
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
};

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuario e obrigatorio"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof (file as File).arrayBuffer !== "function") {
      const output = new Output(false, [], ["Arquivo .xlsx nao encontrado"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const profileInfo = await profileUseCase.getProfileInfoBySupabaseId(supabaseId);
    if (!profileInfo) {
      const output = new Output(false, [], ["Perfil do usuario nao encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
    if (!managerId) {
      const output = new Output(false, [], ["Master nao identificado"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      const output = new Output(false, [], ["Planilha nao encontrada no arquivo"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const headerIndex = findHeaderIndex(rows);
    if (headerIndex === -1) {
      const output = new Output(false, [], ["Cabecalho do ClickUp nao encontrado"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const headerMap = buildHeaderMap(rows[headerIndex]);
    const dataRows = rows.slice(headerIndex + 1);

    const emails = new Set<string>();
    const phones = new Set<string>();
    const cnpjs = new Set<string>();

    dataRows.forEach((row) => {
      const email = normalizeEmail(getCell(row, headerMap, "Email (email)"));
      const phone = normalizeDigits(getCell(row, headerMap, "Telefone (phone)"));
      const cnpj = normalizeDigits(getCell(row, headerMap, "CNPJ (short text)"));
      if (email) emails.add(email);
      if (phone) phones.add(phone);
      if (cnpj) cnpjs.add(cnpj);
    });

    const existingLeads =
      emails.size || phones.size || cnpjs.size
        ? await prisma.lead.findMany({
            where: {
              managerId,
              OR: [
                emails.size ? { email: { in: Array.from(emails) } } : undefined,
                phones.size ? { phone: { in: Array.from(phones) } } : undefined,
                cnpjs.size ? { cnpj: { in: Array.from(cnpjs) } } : undefined,
              ].filter(Boolean) as any,
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

    const existingByEmail = new Map<string, typeof existingLeads[number]>();
    const existingByPhone = new Map<string, typeof existingLeads[number]>();
    const existingByCnpj = new Map<string, typeof existingLeads[number]>();

    existingLeads.forEach((lead) => {
      if (lead.email) existingByEmail.set(normalizeEmail(lead.email), lead);
      if (lead.phone) existingByPhone.set(normalizeDigits(lead.phone), lead);
      if (lead.cnpj) existingByCnpj.set(normalizeDigits(lead.cnpj), lead);
    });

    let created = 0;
    let skipped = 0;
    let sanitized = 0;
    const errors: string[] = [];

    for (const row of dataRows) {
      const name = getCell(row, headerMap, "Task Name");
      if (!name) {
        skipped += 1;
        continue;
      }

      let email = getCell(row, headerMap, "Email (email)");
      let phone = getCell(row, headerMap, "Telefone (phone)");
      let cnpj = getCell(row, headerMap, "CNPJ (short text)");
      const age = getCell(row, headerMap, "Idades (short text)");
      const currentValue = parseCurrency(getCell(row, headerMap, "Valor Atual (currency)"));
      const ticket = parseCurrency(getCell(row, headerMap, "Ticket (currency)"));
      const referenceHospital = getCell(row, headerMap, "Hospital Referencia (Se houver) (short text)");
      const currentTreatment = getCell(
        row,
        headerMap,
        "Existe algum tratamento que esta no fazendo no momento? (short text)"
      );
      const notes = getCell(row, headerMap, "Observacoes Adicionais (text)");
      const status = mapStatus(getCell(row, headerMap, "Status"));
      const planValue =
        getCell(row, headerMap, "Qual o plano no Momento? (drop down)") ||
        getCell(row, headerMap, "Operadora (drop down)");
      const currentHealthPlan = mapHealthPlan(planValue);

      const normalizedEmail = email ? normalizeEmail(email) : "";
      const normalizedPhone = phone ? normalizeDigits(phone) : "";
      const normalizedCnpj = cnpj ? normalizeDigits(cnpj) : "";

      const emailConflict = normalizedEmail ? existingByEmail.get(normalizedEmail) : null;
      const phoneConflict = normalizedPhone ? existingByPhone.get(normalizedPhone) : null;
      const cnpjConflict = normalizedCnpj ? existingByCnpj.get(normalizedCnpj) : null;

      const canReuseEmail = emailConflict && isLostStatus(emailConflict.status) && isLostStatus(status);
      const canReusePhone = phoneConflict && isLostStatus(phoneConflict.status) && isLostStatus(status);
      const canReuseCnpj = cnpjConflict && isLostStatus(cnpjConflict.status) && isLostStatus(status);

      if ((emailConflict && !canReuseEmail) || (phoneConflict && !canReusePhone) || (cnpjConflict && !canReuseCnpj)) {
        skipped += 1;
        continue;
      }

      if (emailConflict && canReuseEmail) {
        email = "";
        sanitized += 1;
      }
      if (phoneConflict && canReusePhone) {
        phone = "";
        sanitized += 1;
      }
      if (cnpjConflict && canReuseCnpj) {
        cnpj = "";
        sanitized += 1;
      }

      const output = await leadUseCase.createLeadFromImport(supabaseId, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        cnpj: cnpj || undefined,
        age: age || undefined,
        currentHealthPlan: currentHealthPlan || undefined,
        currentValue: currentValue ?? undefined,
        referenceHospital: referenceHospital || undefined,
        currentTreatment: currentTreatment || undefined,
        notes: notes || undefined,
        status,
        meetingHeald: undefined,
        closerId: undefined,
        meetingDate: undefined,
        meetingNotes: undefined,
        meetingLink: undefined,
        assignedTo: undefined,
        ticket: ticket ?? undefined,
        contractDueDate: undefined,
        soldPlan: undefined,
      });

      if (!output.isValid) {
        skipped += 1;
        if (output.errorMessages?.[0]) {
          errors.push(output.errorMessages[0]);
        }
        continue;
      }

      created += 1;
    }

    const result = {
      created,
      skipped,
      sanitized,
      errors: errors.slice(0, 10),
    };

    const output = new Output(true, ["Importacao concluida"], [], result);
    return NextResponse.json(output);
  } catch (error) {
    console.error("Erro ao importar leads:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
