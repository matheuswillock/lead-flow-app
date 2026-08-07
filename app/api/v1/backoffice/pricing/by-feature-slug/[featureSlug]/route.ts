import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeProductUseCase } from "@/app/api/useCases/backofficeProduct/BackofficeProductUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureSlug: string }> }
) {
  await connection();

  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { featureSlug } = await params
    const output = await backofficeProductUseCase.listByFeatureSlug(featureSlug)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePricingByFeatureSlugRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
