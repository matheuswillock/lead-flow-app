import { NextRequest, NextResponse } from "next/server";
import { buildStudioOpenApiDocument } from "@/lib/webhooks/inbound/v2/contractDocs";

/**
 * OpenAPI público da API Studio (SPEC 14, DA6): webhook v2 e horários disponíveis. Só contrato, nenhum
 * dado de time, então não exige token (o parceiro importa o arquivo em Postman, Swagger ou numa IA).
 */
export function GET(request: NextRequest) {
  return NextResponse.json(buildStudioOpenApiDocument(request.nextUrl.origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
