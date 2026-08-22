import { NextResponse, connection } from "next/server";
import { prisma } from "@/app/api/infra/data/prisma";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/**
 * Health check de infraestrutura, consumido pelo smoke test pós-deploy do
 * `ci-main.yml`.
 *
 * Executa uma query trivial de propósito: o que precisa ser provado é que o
 * Prisma Client consegue **carregar o query engine no runtime publicado** e
 * abrir conexão. Em 22/08/2026 um deploy subiu íntegro — commit certo, todos
 * os arquivos presentes, `readyState: READY` — e mesmo assim toda rota que
 * tocava o banco devolvia 500, porque o engine tinha sido gerado para outra
 * plataforma. Nenhuma verificação de artefato pega isso; só uma requisição
 * real contra o serviço no ar.
 *
 * Fora de `/api/v1` por ser endpoint de infraestrutura, não de produto.
 * A resposta não expõe detalhes internos: quem chama só precisa do veredito.
 */
export async function GET() {
  await connection();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ok", database: "ok" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
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
