import { NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { healthPlanService } from "@/app/api/services/healthPlans/HealthPlanService";

export async function GET() {
  try {
    const options = await healthPlanService.listOptions();

    return NextResponse.json(
      new Output(true, [], [], {
        healthPlans: options.map((option) => ({
          id: option.id,
          name: option.name,
          iconUrl: option.iconUrl,
          isDefault: option.isDefault,
        })),
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
