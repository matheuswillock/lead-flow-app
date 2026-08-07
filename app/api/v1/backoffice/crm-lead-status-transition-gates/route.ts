import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { backofficeCrmLeadStatusTransitionGateUseCase } from "@/app/api/useCases/backofficeCrmLeadStatusTransitionGate/BackofficeCrmLeadStatusTransitionGateUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const crmLeadStatusSchema = z.enum([
  "new_opportunity",
  "scheduled",
  "no_show",
  "new_adhesion",
  "lost",
  "implementation",
  "finalized",
  "proposal",
  "future_contact",
  "deal_closed",
  "disqualified",
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
  sourceStatus: crmLeadStatusSchema.nullable().optional(),
  targetStatus: crmLeadStatusSchema.nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  blockerType: z.string().min(1),
  errorMessage: z.string().nullable().optional(),
  isEnabled: z.boolean(),
  sortOrder: z.number().int(),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeCrmLeadStatusTransitionGateUseCase.list();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeCrmLeadStatusTransitionGatesRoute][GET]", error);
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
    const parsed = z
      .object({
        id: z.string().uuid(),
        gate: updateGateSchema,
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeCrmLeadStatusTransitionGateUseCase.updateGate(
      parsed.data.id,
      parsed.data.gate,
      access.access.profileId
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeCrmLeadStatusTransitionGatesRoute][PUT]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
