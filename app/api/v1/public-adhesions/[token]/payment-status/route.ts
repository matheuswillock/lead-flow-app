import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  await connection();

  try {
    const { token } = await params
    const sync = request.nextUrl.searchParams.get("sync")
    const output = await backofficeAdhesionUseCase.getPaymentStatus(token, {
      sync: sync === "1" || sync === "true",
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PublicAdhesionPaymentStatusRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
