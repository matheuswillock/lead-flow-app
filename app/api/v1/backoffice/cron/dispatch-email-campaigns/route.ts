import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { backofficeEmailCampaignUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection();

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    await backofficeEmailCampaignUseCase.recoverStuckDispatches()
    const output = await backofficeEmailCampaignUseCase.dispatchDueCampaigns()
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeCronDispatchEmailCampaignsRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de disparo"], null),
      { status: 500 }
    )
  }
}
