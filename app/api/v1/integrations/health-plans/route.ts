import { NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { listCachedHealthPlanOptions } from "@/app/api/useCases/healthPlans/HealthPlanUseCase";

export async function GET() {
  try {
    const options = await listCachedHealthPlanOptions();

    return NextResponse.json(
      new Output(true, [], [], {
        healthPlans: options,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[IntegrationHealthPlansRoute][GET] Erro ao listar planos de saúde:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao listar planos de saúde"], null),
      { status: 500 }
    );
  }
}
