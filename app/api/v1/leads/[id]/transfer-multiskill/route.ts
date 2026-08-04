import { after, NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import { multiskillTransferUseCase } from "@/app/api/useCases/multiskillTransfer/MultiskillTransferUseCase";
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseFactory";
import { TransferMultiskillLeadRequestSchema } from "@/app/api/v1/leads/DTO/requestToTransferMultiskillLead";
import type { TransferLeadBetweenTeamsResult } from "@/app/api/v1/leads/DTO/transferLeadBetweenTeamsResult";
import { invalidateLeadCache, invalidateTeamCalendarCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

function stripInternalTransferResult(
  result: TransferLeadBetweenTeamsResult | null
): Omit<
  TransferLeadBetweenTeamsResult,
  "deferredSchedule" | "transferredByProfileId" | "sourceTeamId" | "targetTeamId"
> | null {
  if (!result) return null;
  const {
    deferredSchedule: _deferred,
    transferredByProfileId: _actor,
    sourceTeamId: _source,
    targetTeamId: _target,
    ...publicResult
  } = result;
  return publicResult;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.info("[LeadTransferMultiskillRoute][POST] iniciado");

  try {
    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!isManagerOrMaster(teamAccess.access)) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado: somente Master, Manager ou Backoffice"], null),
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = TransferMultiskillLeadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], [parsed.error.issues[0]?.message ?? "Payload inválido"], null),
        { status: 400 }
      );
    }

    const output = await multiskillTransferUseCase.transferLead(
      teamAccess.access,
      id,
      parsed.data
    );

    if (output.isValid) {
      const transferResult = output.result as TransferLeadBetweenTeamsResult | null;
      const targetTeamId =
        transferResult?.targetTeamId ??
        transferResult?.deferredSchedule?.teamId ??
        teamAccess.access.teamId;

      invalidateLeadCache({
        leadId: id,
        teamId: targetTeamId,
        previousTeamId: teamAccess.access.teamId,
      });

      if (transferResult?.deferredSchedule) {
        const deferredResult: TransferLeadBetweenTeamsResult = {
          ...transferResult,
          transferredByProfileId:
            transferResult.transferredByProfileId ?? teamAccess.access.profileId,
          sourceTeamId: transferResult.sourceTeamId ?? teamAccess.access.teamId,
          targetTeamId,
        };
        after(async () => {
          await leadUseCase.runDeferredTransferScheduleAfterTransfer(id, deferredResult);
          invalidateTeamCalendarCache({ teamId: teamAccess.access.teamId, leadId: id });
          invalidateTeamCalendarCache({ teamId: targetTeamId, leadId: id });
        });
      } else {
        invalidateTeamCalendarCache({ teamId: teamAccess.access.teamId, leadId: id });
        invalidateTeamCalendarCache({ teamId: targetTeamId, leadId: id });
      }

      const publicOutput = new Output(
        output.isValid,
        output.successMessages,
        output.errorMessages,
        stripInternalTransferResult(transferResult)
      );
      return NextResponse.json(publicOutput, { status: 200 });
    }

    const status = output.errorMessages.some(
      (message) => message.includes("Acesso negado") || message.includes("não configurada")
    )
      ? 403
      : 400;

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTransferMultiskillRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
