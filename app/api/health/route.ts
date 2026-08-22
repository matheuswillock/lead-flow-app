import { NextResponse, connection } from "next/server";
import { healthUseCase } from "@/app/api/useCases/health/HealthUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/**
 * Health check de infraestrutura, consumido pelo smoke test pós-deploy do
 * `ci-main.yml`.
 *
 * Existe porque em 22/08/2026 um deploy subiu íntegro — commit certo, arquivos
 * presentes, `readyState: READY`, SHA conferido — e ainda assim toda rota que
 * tocava o banco devolvia 500: o Prisma engine tinha sido gerado para outra
 * plataforma. Nenhuma verificação de artefato pega isso; só uma requisição
 * real contra o serviço no ar.
 *
 * Fora de `/api/v1` por ser endpoint de infraestrutura, não de produto.
 */
export async function GET() {
  await connection();

  try {
    const output = await healthUseCase.checkDatabase();

    return NextResponse.json(
      { status: output.isValid ? "ok" : "error", ...(output.result as object) },
      {
        status: output.isValid ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[HealthRoute][GET]", error);

    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
