import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { backofficeRadarEngagementWeightUseCase } from "@/app/api/useCases/backofficeRadarEngagement/BackofficeRadarEngagementWeightUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const weightItemSchema = z.object({
  eventType: z.string().trim().min(1),
  weight: z.number().int(),
  description: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

const upsertSchema = z.object({
  weights: z.array(weightItemSchema).min(1),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeRadarEngagementWeightUseCase.list();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeRadarEngagementWeightsRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });
    const denied = requireManagerAccess(access.access);
    if (denied) return denied;

    const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeRadarEngagementWeightUseCase.upsert(parsed.data.weights);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeRadarEngagementWeightsRoute][PUT]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
