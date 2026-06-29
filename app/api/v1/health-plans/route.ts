import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { invalidateHealthPlansCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  healthPlanUseCase,
  HEALTH_PLAN_ERROR_MESSAGES,
} from "@/app/api/useCases/healthPlans/HealthPlanUseCase";

const createHealthPlanBodySchema = z.object({
  name: z.string().trim().min(1, HEALTH_PLAN_ERROR_MESSAGES.INVALID_NAME),
});

export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id") || "";
    const output = await healthPlanUseCase.listHealthPlans(supabaseId);

    if (!output.isValid) {
      if (output.errorMessages.includes(HEALTH_PLAN_ERROR_MESSAGES.MISSING_SUPABASE_ID)) {
        return NextResponse.json(output, { status: 401 });
      }
      if (output.errorMessages.includes(HEALTH_PLAN_ERROR_MESSAGES.PROFILE_NOT_FOUND)) {
        return NextResponse.json(output, { status: 404 });
      }
      return NextResponse.json(output, { status: 400 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[HealthPlansRoute][GET] Erro ao listar planos de saúde:", error);
    return NextResponse.json(new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.INTERNAL_LIST_ERROR], null), {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id") || "";

    const body = await request.json();
    const parsed = createHealthPlanBodySchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const output = await healthPlanUseCase.createHealthPlan(supabaseId, parsed.data.name);

    if (!output.isValid) {
      if (output.errorMessages.includes(HEALTH_PLAN_ERROR_MESSAGES.MISSING_SUPABASE_ID)) {
        return NextResponse.json(output, { status: 401 });
      }
      if (output.errorMessages.includes(HEALTH_PLAN_ERROR_MESSAGES.PROFILE_NOT_FOUND)) {
        return NextResponse.json(output, { status: 404 });
      }
      if (output.errorMessages.includes(HEALTH_PLAN_ERROR_MESSAGES.FORBIDDEN_CREATE)) {
        return NextResponse.json(output, { status: 403 });
      }
      if (output.errorMessages.includes(HEALTH_PLAN_ERROR_MESSAGES.DUPLICATED_NAME)) {
        return NextResponse.json(output, { status: 409 });
      }
      return NextResponse.json(output, { status: 400 });
    }

    invalidateHealthPlansCache();
    return NextResponse.json(output, { status: 201 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[HealthPlansRoute][POST] Erro ao criar plano de saúde:", error);
    return NextResponse.json(new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.INTERNAL_CREATE_ERROR], null), {
      status: 500,
    });
  }
}
