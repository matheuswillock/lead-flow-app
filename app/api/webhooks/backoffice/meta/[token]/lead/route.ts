import { NextResponse, type NextRequest } from "next/server"
import { backofficeMetaWebhookUseCase } from "@/app/api/useCases/backofficeMetaWebhook/BackofficeMetaWebhookUseCase"
import type { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function resolveOutputStatus(output: Output): number {
  const result = output.result
  if (
    result &&
    typeof result === "object" &&
    "statusCode" in result &&
    typeof result.statusCode === "number"
  ) {
    return result.statusCode
  }

  if (output.isValid) return 200
  if (
    output.errorMessages.includes("Token inválido") ||
    output.errorMessages.includes("Token expirado") ||
    output.errorMessages.includes("Token ativo não configurado")
  ) {
    return 401
  }

  return 400
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const rawBody = await request.text()

    const output = await backofficeMetaWebhookUseCase.ingest({
      rawBody,
      providedToken: token ?? null,
      method: request.method,
      endpoint: request.nextUrl.pathname,
    })
    const status = resolveOutputStatus(output)

    if (!output.isValid) {
      console.error("[BackofficeMetaLeadWebhookRoute][POST]", output.errorMessages)
      return NextResponse.json(
        { success: false, message: output.errorMessages[0] ?? "Erro" },
        { status }
      )
    }

    return NextResponse.json(
      { success: true, message: output.successMessages[0] ?? "Recebido" },
      { status }
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeMetaLeadWebhookRoute][POST] Falha inesperada:", error)
    return NextResponse.json(
      { success: false, message: "Erro interno" },
      { status: 200 }
    )
  }
}
