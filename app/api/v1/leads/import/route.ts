import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { invalidateTeamLeadsCache } from "@/lib/cache/invalidation";
import { readXlsxRowsFromBuffer } from "@/lib/spreadsheet/readXlsxRows";
import { prisma } from "@/app/api/infra/data/prisma";
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase";
import { healthPlanService } from "@/app/api/services/healthPlans/HealthPlanService";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  isLostStatus,
  mapHealthPlan,
  mapStatus,
  normalizeDigits,
  normalizeEmail,
  normalizeText,
  parseCurrency,
} from "@/lib/leadImport/normalizers";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

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

    const teamId = request.headers.get("x-team-id") || profileInfo.activeTeamId;
    if (!teamId) {
      const output = new Output(false, [], ["Team ID é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const buffer = await (file as File).arrayBuffer();
    const rows = await readXlsxRowsFromBuffer(buffer);

    const headerIndex = findHeaderIndex(rows);
    if (headerIndex === -1) {
      const output = new Output(false, [], ["Cabecalho do ClickUp nao encontrado"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const headerMap = buildHeaderMap(rows[headerIndex]);
    const dataRows = rows.slice(headerIndex + 1);
    const healthPlanOptions = await healthPlanService.listOptions();
    const healthPlanOptionNameByNormalized = new Map(
      healthPlanOptions.map((option) => [option.normalizedName, option.name])
    );

    const emails = new Set<string>();
    const cnpjs = new Set<string>();

    dataRows.forEach((row) => {
      const email = normalizeEmail(getCell(row, headerMap, "Email (email)"));
      const cnpj = normalizeDigits(getCell(row, headerMap, "CNPJ (short text)"));
      if (email) emails.add(email);
      if (cnpj) cnpjs.add(cnpj);
    });

    const existingLeads =
      emails.size || cnpjs.size
        ? await prisma.lead.findMany({
            where: {
              teamId,
              OR: [
                emails.size ? { email: { in: Array.from(emails) } } : undefined,
                cnpjs.size ? { cnpj: { in: Array.from(cnpjs) } } : undefined,
              ].filter(Boolean) as any,
            },
            select: {
              id: true,
              email: true,
              cnpj: true,
              status: true,
            },
          })
        : [];

    const existingByEmail = new Map<string, typeof existingLeads[number]>();
    const existingByCnpj = new Map<string, typeof existingLeads[number]>();

    existingLeads.forEach((lead) => {
      if (lead.email) existingByEmail.set(normalizeEmail(lead.email), lead);
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
      const phone = getCell(row, headerMap, "Telefone (phone)");
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
      const currentHealthPlan = mapHealthPlan(planValue, healthPlanOptionNameByNormalized);

      const normalizedEmail = email ? normalizeEmail(email) : "";
      const normalizedCnpj = cnpj ? normalizeDigits(cnpj) : "";

      const emailConflict = normalizedEmail ? existingByEmail.get(normalizedEmail) : null;
      const cnpjConflict = normalizedCnpj ? existingByCnpj.get(normalizedCnpj) : null;

      const canReuseEmail = emailConflict && isLostStatus(emailConflict.status) && isLostStatus(status);
      const canReuseCnpj = cnpjConflict && isLostStatus(cnpjConflict.status) && isLostStatus(status);

      if ((emailConflict && !canReuseEmail) || (cnpjConflict && !canReuseCnpj)) {
        skipped += 1;
        continue;
      }

      if (emailConflict && canReuseEmail) {
        email = "";
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
        meetingTitle: undefined,
        meetingNotes: undefined,
        meetingLink: undefined,
        assignedTo: undefined,
        ticket: ticket ?? undefined,
        contractDueDate: undefined,
        soldPlan: undefined,
      }, teamId);

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

    if (created > 0) {
      invalidateTeamLeadsCache({ teamId });
    }
    const output = new Output(true, ["Importacao concluida"], [], result);
    return NextResponse.json(output);
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao importar leads:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
