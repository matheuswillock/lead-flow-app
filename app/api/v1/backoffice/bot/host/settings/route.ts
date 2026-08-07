import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotHostUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotHostUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const patchSchema = z.object({
  agentBaseUrl: z.string().url().nullable().optional(),
  desiredHostVersion: z.string().max(120).nullable().optional(),
  n8nEnv: z.record(z.string(), z.string()).optional(),
  evolutionEnv: z.record(z.string(), z.string()).optional(),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeBotHostUseCase.getSettings();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotHostSettingsRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeBotHostUseCase.updateSettings(parsed.data, {
      profileId: accessResult.access.profileId,
      fullAccess: accessResult.access.fullAccess,
    });
    return NextResponse.json(output, { status: output.isValid ? 200 : output.errorMessages[0]?.includes("MASTER") ? 403 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotHostSettingsRoute][PATCH]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
