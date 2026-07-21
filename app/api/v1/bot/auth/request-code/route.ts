import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { backofficeBotAuthUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotAuthUseCase";
import { verifyStudioBotRequest } from "@/app/api/v1/bot/utils/verifyStudioBotRequest";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const schema = z.object({
  email: z.string().email(),
  normalizedPhone: z.string().min(8),
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

    const output = await backofficeBotAuthUseCase.requestCode(
      parsed.data.email,
      parsed.data.normalizedPhone
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BotAuthRequestCodeRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
