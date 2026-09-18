import "server-only"

import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { isPublicFormServableOnHost } from "./team-form-domain-tenancy"

/**
 * Mesma mensagem do "formulário inexistente": em host de outro time o
 * formulário simplesmente NÃO EXISTE do ponto de vista daquele domínio, e o
 * 404 não deve confirmar a existência do publicId para quem forjou o Host.
 */
const FOREIGN_HOST_MESSAGE = "Formulário não encontrado"

/**
 * Guarda de tenancy por hostname para as ROTAS públicas do formulário
 * (`/api/(q|v1)/public-forms/{publicId}/**`).
 *
 * O proxy libera essas rotas em host custom sem consultar banco, então sem
 * esta checagem o domínio verificado do time A serviria snapshot, prefill,
 * disponibilidade e — pior — aceitaria SUBMISSÃO de formulário do time B
 * (`Origin` ausente passa no `isPublicFormRequestOriginAllowed`). É o mesmo
 * isolamento que `app/forms/[publicId]/page.tsx` aplica à página.
 *
 * Retorna `null` quando o request pode seguir, ou a resposta 404 quando não.
 * Host da plataforma (caminho normal, inclusive embed por iframe) e host
 * neutro de fallback nunca consultam banco aqui.
 */
export async function rejectPublicFormRequestOnForeignHost(
  request: Request,
  publicId: string,
): Promise<NextResponse | null> {
  const hostHeader = request.headers.get("host")
  const allowed = await isPublicFormServableOnHost({ publicId, hostHeader })
  if (allowed) return null

  console.info("[PublicFormHostTenancyGuard] request recusado: formulário de outro time", {
    publicId,
    host: hostHeader,
  })
  return NextResponse.json(new Output(false, [], [FOREIGN_HOST_MESSAGE], null), {
    status: 404,
  })
}
