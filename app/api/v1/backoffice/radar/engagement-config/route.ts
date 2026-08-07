import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { backofficeRadarEngagementConfigUseCase } from "@/app/api/useCases/backofficeRadarEngagement/BackofficeRadarEngagementConfigUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const patchSchema = z.object({
  windowRecentDays: z.number().int().positive(),
  windowMidDays: z.number().int().positive(),
  windowOldDays: z.number().int().positive(),
  recentMultiplier: z.number().positive(),
  oldMultiplier: z.number().min(0),
  hotThreshold: z.number().int(),
  warmThreshold: z.number().int(),
  lukewarmThreshold: z.number().int().min(0),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeRadarEngagementConfigUseCase.get();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeRadarEngagementConfigRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });
    const denied = requireManagerAccess(access.access);
    if (denied) return denied;

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeRadarEngagementConfigUseCase.upsert(parsed.data);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeRadarEngagementConfigRoute][PATCH]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
