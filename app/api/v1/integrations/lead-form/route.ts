import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { PublicLeadFormRequestSchema } from "./DTO/requestPublicLeadForm";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity";

const normalizeTrackingValue = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const getFirstForwardedIp = (request: NextRequest): string | undefined => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return undefined;

  const [firstIp] = forwardedFor.split(",");
  return normalizeTrackingValue(firstIp);
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = PublicLeadFormRequestSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const canonicalSource =
      normalizeTrackingValue(validation.data.source) ||
      normalizeTrackingValue(validation.data.utmSource) ||
      "public_lead_form";

    const hasScheduling = !!(
      validation.data.closerId &&
      validation.data.meetingDate &&
      validation.data.meetingTitle
    );

    const originContext = {
      source: canonicalSource,
      utmSource: normalizeTrackingValue(validation.data.utmSource),
      utmMedium: normalizeTrackingValue(validation.data.utmMedium),
      utmCampaign: normalizeTrackingValue(validation.data.utmCampaign),
      utmContent: normalizeTrackingValue(validation.data.utmContent),
      utmTerm: normalizeTrackingValue(validation.data.utmTerm),
      landingUrl: normalizeTrackingValue(validation.data.landingUrl),
      referrer:
        normalizeTrackingValue(validation.data.referrer) ||
        normalizeTrackingValue(request.headers.get("referer")),
      userAgent: normalizeTrackingValue(request.headers.get("user-agent")),
      ip: getFirstForwardedIp(request),
      submittedAt: new Date().toISOString(),
    };

    const sqlInspectionCandidates: Array<{
      field: string;
      value: string | undefined;
    }> = [
      { field: "name", value: validation.data.name },
      { field: "email", value: validation.data.email },
      { field: "phone", value: validation.data.phone },
      { field: "cnpj", value: validation.data.cnpj },
      { field: "age", value: validation.data.age },
      { field: "currentHealthPlan", value: validation.data.currentHealthPlan },
      { field: "referenceHospital", value: validation.data.referenceHospital },
      { field: "currentTreatment", value: validation.data.currentTreatment },
      { field: "notes", value: validation.data.notes },
      { field: "meetingTitle", value: validation.data.meetingTitle },
      { field: "meetingNotes", value: validation.data.meetingNotes },
    ];

    for (const candidate of sqlInspectionCandidates) {
      if (!candidate.value) continue;
      const detection = detectSqlInjection(candidate.value);
      if (!detection.suspicious) continue;

      console.warn("[IntegrationLeadFormRoute][POST] Conteúdo suspeito detectado", {
        field: candidate.field,
        rule: detection.rule,
        teamId: validation.data.teamId,
        supabaseId: validation.data.supabaseId,
        source: canonicalSource,
      });

      return NextResponse.json(
        new Output(false, [], ["Dados inválidos para submissão."], null),
        { status: 400 }
      );
    }

    const output = await publicLeadFormUseCase.createPublicLead(validation.data, originContext);

    if (!output.isValid) {
      const isNotFound = output.errorMessages.some(
        (msg) => msg.includes("não encontrado") || msg.includes("não pertence")
      );
      return NextResponse.json(output, { status: isNotFound ? 404 : 400 });
    }

    const result = output.result as { id?: string } | null;
    console.info("[IntegrationLeadFormRoute][POST] Lead público criado com sucesso", {
      leadId: result?.id ?? null,
      teamId: validation.data.teamId,
      supabaseId: validation.data.supabaseId,
      source: canonicalSource,
      hasScheduling,
    });

    return NextResponse.json(output, { status: 201 });
  } catch (error) {
    console.error("[IntegrationLeadFormRoute][POST] Erro ao criar lead público:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
