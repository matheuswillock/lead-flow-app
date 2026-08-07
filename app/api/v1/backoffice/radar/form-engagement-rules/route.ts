import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { backofficeFormEngagementScoreRuleUseCase } from "@/app/api/useCases/backofficeRadarEngagement/BackofficeFormEngagementScoreRuleUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const ruleItemSchema = z.object({
  id: z.string().uuid().optional(),
  minPercent: z.number().int().min(0).max(100),
  maxPercent: z.number().int().min(0).max(100),
  multiplier: z.number().min(0),
  label: z.string().trim().min(1),
  isActive: z.boolean().optional(),
});

const upsertSchema = z.object({
  rules: z.array(ruleItemSchema).min(1),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const output = await backofficeFormEngagementScoreRuleUseCase.list();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeFormEngagementRulesRoute][GET]", error);
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

    const output = await backofficeFormEngagementScoreRuleUseCase.upsert(parsed.data.rules);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeFormEngagementRulesRoute][PUT]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });
    const denied = requireManagerAccess(access.access);
    if (denied) return denied;

    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await backofficeFormEngagementScoreRuleUseCase.delete(parsed.data.id);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeFormEngagementRulesRoute][DELETE]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
