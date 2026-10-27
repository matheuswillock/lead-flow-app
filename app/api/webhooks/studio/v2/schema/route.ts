import { NextResponse } from "next/server";
import { buildInboundV2JsonSchema } from "@/lib/webhooks/inbound/v2/contractDocs";

/** JSON Schema público do evento do webhook v2 (SPEC 11, DA8). Só contrato, nenhum dado de time. */
export function GET() {
  return NextResponse.json(buildInboundV2JsonSchema(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
