import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotHostUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotHostUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const bodySchema = z.object({
  service: z.enum(["n8n", "api", "all"]),
});

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeBotHostUseCase.restart(parsed.data.service, {
      profileId: accessResult.access.profileId,
      fullAccess: accessResult.access.fullAccess,
    });
    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages[0]?.includes("MASTER") ? 403 : 400,
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotHostRestartRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
