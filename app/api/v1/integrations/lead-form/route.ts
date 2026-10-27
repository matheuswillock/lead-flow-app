import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { PublicLeadFormRequestSchema } from "./DTO/requestPublicLeadForm";
import {
  publicLeadFormUseCase,
  PUBLIC_LEAD_FORM_NEUTRAL_SUCCESS_MESSAGE,
} from "@/app/api/useCases/integrations/PublicLeadFormUseCase";
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity";
import { invalidateLeadCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
} from "@/lib/public-forms/rate-limit";

// SPEC 40 DA1 (V3): mesmo teto das submissões de formulário nativo
// (`public-forms/[publicId]/submissions/route.ts`) — 10 envios a cada 10
// minutos por IP+time, e um teto adicional de 200 por hora só por time
// (sem depender do IP, que um atacante distribuído pode variar).
const LEAD_FORM_RATE_LIMIT_MESSAGE = "Recebemos muitos envios agora. Tente de novo em alguns minutos.";

function tooManyRequestsResponse(retryAfterSeconds: number) {
  return NextResponse.json(new Output(false, [], [LEAD_FORM_RATE_LIMIT_MESSAGE], null), {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

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

    const { teamId } = validation.data;
    const fingerprint = publicFormRequestFingerprint(request);

    const perIpRate = await consumePublicFormRateLimit(`lead-form:${teamId}:${fingerprint}`, {
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if (!perIpRate.allowed) {
      return tooManyRequestsResponse(perIpRate.retryAfterSeconds);
    }

    const perTeamRate = await consumePublicFormRateLimit(`lead-form-team:${teamId}`, {
      limit: 200,
      windowMs: 60 * 60_000,
    });
    if (!perTeamRate.allowed) {
      return tooManyRequestsResponse(perTeamRate.retryAfterSeconds);
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
      { field: "assignedTo", value: validation.data.assignedTo },
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
    if (result?.id) {
      invalidateLeadCache({ leadId: result.id, teamId: validation.data.teamId });
    }

    // SPEC 40 DA2 (V8): quando `result.id` é nulo, o envio foi aceito de
    // forma neutra (duplicata bloqueada por dentro, D25 em aberto) — o log
    // interno distingue os dois casos sem expor qualquer dado do lead
    // existente, que `publicLeadFormUseCase.createPublicLead` já removeu.
    console.info(
      result?.id
        ? "[IntegrationLeadFormRoute][POST] Lead público criado com sucesso"
        : "[IntegrationLeadFormRoute][POST] Envio público aceito de forma neutra (duplicata)",
      {
        leadId: result?.id ?? null,
        teamId: validation.data.teamId,
        supabaseId: validation.data.supabaseId,
        source: canonicalSource,
        hasScheduling,
      }
    );

    // SPEC 40 R40-1/R40-2 (V8): `output.result` de um lead criado com
    // sucesso vem de `LeadUseCase.createLead` e inclui `manager`/
    // `assignee`/`closer` com e-mail (campos legítimos para o CRM
    // autenticado, nunca para quem preenche o formulário público sem
    // login). A resposta pública NUNCA leva `result`, e a mensagem é
    // sempre a mesma — com ou sem duplicata, com ou sem agendamento —
    // para que sucesso e duplicata sejam absolutamente idênticos aos
    // olhos de quem chamou. O frontend só lê `successMessages[0]` para o
    // toast e nunca lê `result` (`PublicLeadForm.tsx`).
    return NextResponse.json(
      new Output(true, [PUBLIC_LEAD_FORM_NEUTRAL_SUCCESS_MESSAGE], [], null),
      { status: 201 }
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[IntegrationLeadFormRoute][POST] Erro ao criar lead público:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
