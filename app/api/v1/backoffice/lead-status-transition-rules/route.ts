import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { backofficeLeadStatusTransitionRuleUseCase } from "@/app/api/useCases/backofficeLeadStatusTransitionRule/BackofficeLeadStatusTransitionRuleUseCase";
import { LEAD_TRANSITION_FIELD_KEYS } from "@/lib/leadStatusTransitionFields";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const leadStatusSchema = z.enum([
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
]);

const fieldKeySchema = z.enum(LEAD_TRANSITION_FIELD_KEYS as [LeadTransitionFieldKey, ...LeadTransitionFieldKey[]]);

const replaceRuleSchema = z.object({
  targetStatus: leadStatusSchema,
  fieldKeys: z.array(fieldKeySchema).default([]),
});

const replaceAllSchema = z.object({
  rules: z.array(replaceRuleSchema).default([]),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeLeadStatusTransitionRuleUseCase.list();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadStatusTransitionRulesRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });
    const denied = requireManagerAccess(access.access);
    if (denied) return denied;

    const body = await request.json().catch(() => null);

    const singleParsed = replaceRuleSchema.safeParse(body);
    if (singleParsed.success) {
      const output = await backofficeLeadStatusTransitionRuleUseCase.replaceForTargetStatus(
        singleParsed.data.targetStatus,
        singleParsed.data.fieldKeys,
        access.access.profileId
      );
      return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
    }

    const allParsed = replaceAllSchema.safeParse(body);
    if (!allParsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeLeadStatusTransitionRuleUseCase.replaceAll(
      allParsed.data.rules,
      access.access.profileId
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadStatusTransitionRulesRoute][PUT]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
