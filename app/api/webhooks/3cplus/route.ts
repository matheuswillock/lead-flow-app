import { NextResponse, type NextRequest } from "next/server";

/**
 * Stub legado da 3CPlus (V17, SPEC 11 A-E7). Aceitava qualquer corpo, sem autenticação, com 200, e
 * gravava o payload nos logs. A integração real é o webhook v2; este endpoint devolve 410 por um
 * ciclo, com o ponteiro, e depois sai (D12). Não lê nem registra o corpo.
 */
const GONE_BODY = {
  error: "gone",
  message:
    "Este endpoint foi descontinuado. Use o webhook v2: POST /api/webhooks/studio/v2/{teamId} com o token no header Authorization (Bearer). Consulte o Guia de Integração do Webhook v2.",
};

export async function POST(_request: NextRequest) {
  return NextResponse.json(GONE_BODY, { status: 410 });
}

export async function GET() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}
