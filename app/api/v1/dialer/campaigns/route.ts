import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import { dialerCampaignUseCase } from "@/app/api/useCases/dialer/DialerCampaignUseCase";

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
});

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    const output = await dialerCampaignUseCase.listCampaigns({
      teamId: access.teamId,
      profileId: access.profileId,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    console.error("[DialerCampaignsRoute][GET]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar campanhas"], null),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    if (!isManagerOrMaster(access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem criar campanhas"], null),
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], ["Dados inválidos para criar campanha"], null),
        { status: 400 }
      );
    }

    const output = await dialerCampaignUseCase.createCampaign(
      { teamId: access.teamId, profileId: access.profileId },
      parsed.data
    );

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    console.error("[DialerCampaignsRoute][POST]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao criar campanha"], null),
      { status: 500 }
    );
  }
}
