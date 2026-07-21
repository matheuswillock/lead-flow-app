import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { TransferLeadBetweenTeamsRequestSchema } from "../../DTO/requestToTransferLeadBetweenTeams";
import type { TransferLeadBetweenTeamsResult } from "../../DTO/transferLeadBetweenTeamsResult";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import { invalidateLeadCache, invalidateTeamCalendarCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

function stripInternalTransferResult(
  result: TransferLeadBetweenTeamsResult | null
): Omit<TransferLeadBetweenTeamsResult, "deferredSchedule" | "transferredByProfileId" | "sourceTeamId" | "targetTeamId"> | null {
  if (!result) return null;
  const { deferredSchedule: _deferred, transferredByProfileId: _actor, sourceTeamId: _source, targetTeamId: _target, ...publicResult } = result;
  return publicResult;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    if (!isManagerOrMaster(access)) {
      const output = new Output(false, [], ["Acesso negado: apenas managers e masters podem transferir leads entre times."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json();
    const validation = TransferLeadBetweenTeamsRequestSchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;
    const output = await leadUseCase.transferLeadBetweenTeams(access.supabaseId, access.teamId, id, validation.data);

    if (output.isValid) {
      const transferResult = output.result as TransferLeadBetweenTeamsResult | null;
      const targetTeamId = validation.data.targetTeamId;

      invalidateLeadCache({ leadId: id, teamId: targetTeamId, previousTeamId: access.teamId });

      if (transferResult?.deferredSchedule) {
        const deferredResult = transferResult;
        after(async () => {
          await leadUseCase.runDeferredTransferScheduleAfterTransfer(id, deferredResult);
          invalidateTeamCalendarCache({ teamId: access.teamId, leadId: id });
          invalidateTeamCalendarCache({ teamId: targetTeamId, leadId: id });
        });
      } else {
        invalidateTeamCalendarCache({ teamId: access.teamId, leadId: id });
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

    const isUniqueConflict =
      Array.isArray(output.errorMessages) &&
      output.errorMessages.some((message) => message.startsWith("Já existe um lead com este"));
    const status = isUniqueConflict ? 409 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TransferLeadBetweenTeamsRoute][POST] Erro interno:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
