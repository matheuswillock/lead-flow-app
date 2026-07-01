import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { backofficeBotActionUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotActionUseCase";
import { verifyStudioBotRequest } from "@/app/api/v1/bot/utils/verifyStudioBotRequest";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const schema = z.object({
  normalizedPhone: z.string().min(8),
  action: z.string().min(1),
  userLinkId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const verified = await verifyStudioBotRequest(request);
    if (!verified.ok) {
      return NextResponse.json(verified.error, { status: verified.status });
    }

    const parsed = schema.safeParse(JSON.parse(verified.body));
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const userLinkId =
      parsed.data.userLinkId ?? request.headers.get("x-bot-user-link-id") ?? undefined;
    if (!userLinkId) {
      return NextResponse.json(new Output(false, [], ["userLinkId é obrigatório"], null), {
        status: 400,
      });
    }

    const output = await backofficeBotActionUseCase.executeAction(parsed.data.action, {
      userLinkId,
      teamId: parsed.data.teamId ?? request.headers.get("x-team-id"),
      params: parsed.data.params,
    });
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[StudioBotActionWebhookRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
