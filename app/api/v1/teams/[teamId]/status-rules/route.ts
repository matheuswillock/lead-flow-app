import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamStatusRulesUseCase } from "@/app/api/useCases/teamStatusRules/TeamStatusRulesUseCase";
import { isManagerLikeRole } from "@/lib/roles";

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

const leadTimeUnitSchema = z.enum(["hours", "days"]);

const updateTeamStatusRulesSchema = z.object({
  disabledStatuses: z.array(leadStatusSchema).default([]),
  leadTimeRules: z
    .array(
      z.object({
        status: leadStatusSchema,
        leadTimeValue: z.number().int().positive(),
        leadTimeUnit: leadTimeUnitSchema,
      })
    )
    .default([]),
  combinedRules: z
    .array(
      z.object({
        targetStatus: leadStatusSchema,
        requiredStatus: leadStatusSchema,
        requireConfirmation: z.boolean().optional().default(false),
        confirmationMessage: z.string().trim().max(400).nullable().optional(),
        isEnabled: z.boolean().optional().default(true),
      })
    )
    .default([]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    const output = await teamStatusRulesUseCase.getRules(teamId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[TeamStatusRulesRoute][GET] Erro ao carregar regras:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao carregar regras do time"], null),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem atualizar regras do time"], null),
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateTeamStatusRulesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          parsed.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    const output = await teamStatusRulesUseCase.replaceRules(
      teamId,
      teamAccess.access.profileId,
      {
        disabledStatuses: parsed.data.disabledStatuses,
        leadTimeRules: parsed.data.leadTimeRules,
        combinedRules: parsed.data.combinedRules.map((rule) => ({
          targetStatus: rule.targetStatus,
          requiredStatus: rule.requiredStatus,
          requireConfirmation: rule.requireConfirmation,
          confirmationMessage: rule.confirmationMessage ?? null,
          isEnabled: rule.isEnabled,
        })),
      }
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[TeamStatusRulesRoute][PUT] Erro ao atualizar regras:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar regras do time"], null),
      { status: 500 }
    );
  }
}
