import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess";
import { backofficeLeadStatusTransitionGateUseCase } from "@/app/api/useCases/backofficeLeadStatusTransitionGate/BackofficeLeadStatusTransitionGateUseCase";
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

const gateTypeSchema = z.enum([
  "allowed_target_statuses",
  "block_targets_when_field_equals",
  "require_meeting_heald_on_exit",
  "require_no_show_preconditions",
  "require_sales_info",
  "require_finalize_contract",
  "require_schedule_artifacts",
  "require_trigger_future_sale",
  "require_trigger_loss_reason",
  "require_email_for_online_schedule",
  "require_finalize_contract_flow",
  "require_closer",
]);

const updateGateSchema = z.object({
  name: z.string().min(1),
  gateType: gateTypeSchema,
  sourceStatus: leadStatusSchema.nullable().optional(),
  targetStatus: leadStatusSchema.nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  blockerType: z.string().min(1),
  errorMessage: z.string().nullable().optional(),
  isEnabled: z.boolean(),
  sortOrder: z.number().int(),
});

export async function GET(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeLeadStatusTransitionGateUseCase.list();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadStatusTransitionGatesRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });
    const denied = requireMasterAccess(access.access);
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = z
      .object({
        id: z.string().uuid(),
        gate: updateGateSchema,
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeLeadStatusTransitionGateUseCase.updateGate(
      parsed.data.id,
      parsed.data.gate,
      access.access.profileId
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadStatusTransitionGatesRoute][PUT]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
