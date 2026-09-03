import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotHostUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotHostUseCase";
import { HOST_AGENT_SERVICES } from "@/lib/studio-bot/host-services";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const querySchema = z.object({
  service: z.enum(HOST_AGENT_SERVICES),
  tail: z.coerce.number().int().min(1).max(1000).optional(),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      service: searchParams.get("service"),
      tail: searchParams.get("tail") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          [
            `Parâmetros inválidos: service=${HOST_AGENT_SERVICES.join("|")} e tail opcional (1–1000)`,
          ],
          null
        ),
        { status: 400 }
      );
    }

    const output = await backofficeBotHostUseCase.fetchLogs(parsed.data, {
      profileId: accessResult.access.profileId,
      fullAccess: accessResult.access.fullAccess,
    });
    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages[0]?.includes("MASTER") ? 403 : 400,
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotHostLogsRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
