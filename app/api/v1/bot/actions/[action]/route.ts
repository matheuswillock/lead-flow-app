import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { backofficeBotActionUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotActionUseCase";
import { verifyStudioBotRequest } from "@/app/api/v1/bot/utils/verifyStudioBotRequest";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const schema = z.object({
  userLinkId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  flowId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const verified = await verifyStudioBotRequest(request);
    if (!verified.ok) {
      return NextResponse.json(verified.error, { status: verified.status });
    }

    const { action } = await params;
    const parsed = schema.safeParse(JSON.parse(verified.body));
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeBotActionUseCase.executeAction(action, {
      userLinkId: parsed.data.userLinkId,
      teamId: parsed.data.teamId ?? request.headers.get("x-team-id"),
      params: parsed.data.params,
      flowId: parsed.data.flowId,
    });
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BotActionRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
