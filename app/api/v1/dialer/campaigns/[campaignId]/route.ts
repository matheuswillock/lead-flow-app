import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import {
  dialerCampaignUseCase,
  DIALER_CAMPAIGN_ERROR_MESSAGES,
} from "@/app/api/useCases/dialer/DialerCampaignUseCase";

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
});

function resolveStatus(output: Output) {
  const messages = output.errorMessages.join(" ");
  if (messages.includes(DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND)) {
    return 404;
  }
  if (messages.includes(DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_LOCKED)) {
    return 409;
  }
  if (messages.includes(DIALER_CAMPAIGN_ERROR_MESSAGES.INTERNAL_ERROR)) {
    return 500;
  }
  return 400;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { campaignId } = await params;
    const { access } = teamAccess;
    const output = await dialerCampaignUseCase.getCampaign(
      { teamId: access.teamId, profileId: access.profileId },
      campaignId
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) });
  } catch (error) {
    console.error("[DialerCampaignByIdRoute][GET]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao buscar campanha"], null),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    if (!isManagerOrMaster(access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem editar campanhas"], null),
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], ["Dados inválidos para atualizar campanha"], null),
        { status: 400 }
      );
    }

    const { campaignId } = await params;
    const output = await dialerCampaignUseCase.updateCampaign(
      { teamId: access.teamId, profileId: access.profileId },
      campaignId,
      parsed.data
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) });
  } catch (error) {
    console.error("[DialerCampaignByIdRoute][PUT]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar campanha"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    if (!isManagerOrMaster(access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem excluir campanhas"], null),
        { status: 403 }
      );
    }

    const { campaignId } = await params;
    const output = await dialerCampaignUseCase.deleteCampaign(
      { teamId: access.teamId, profileId: access.profileId },
      campaignId
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) });
  } catch (error) {
    console.error("[DialerCampaignByIdRoute][DELETE]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao excluir campanha"], null),
      { status: 500 }
    );
  }
}
