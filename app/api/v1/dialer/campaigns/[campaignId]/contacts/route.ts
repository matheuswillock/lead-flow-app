import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import {
  dialerCampaignUseCase,
  DIALER_CAMPAIGN_ERROR_MESSAGES,
} from "@/app/api/useCases/dialer/DialerCampaignUseCase";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
    );

    const { campaignId } = await params;
    const { access } = teamAccess;
    const output = await dialerCampaignUseCase.listContacts(
      { teamId: access.teamId, profileId: access.profileId },
      campaignId,
      { page, pageSize }
    );

    const status = output.isValid
      ? 200
      : output.errorMessages.join(" ").includes(DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND)
        ? 404
        : 500;

    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("[DialerCampaignContactsRoute][GET]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar contatos"], null),
      { status: 500 }
    );
  }
}
