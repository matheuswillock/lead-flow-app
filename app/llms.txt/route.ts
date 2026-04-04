import { NextResponse } from "next/server"
import { getAbsoluteUrl } from "@/lib/metadata/share"

export const revalidate = 3600

export async function GET() {
  const content = [
    "# Corretor Studio",
    "",
    "Corretor Studio e uma plataforma SaaS de gestao de leads para corretores de planos de saude.",
    "A plataforma centraliza CRM, pipeline, agenda de reunioes, operacao em equipe e acompanhamento de conversao.",
    "",
    "## Public URLs",
    `- Home: ${getAbsoluteUrl("/")}`,
    `- Assinatura: ${getAbsoluteUrl("/subscribe")}`,
    `- Politica de Privacidade: ${getAbsoluteUrl("/privacy-policy")}`,
    `- Termos de Uso: ${getAbsoluteUrl("/terms")}`,
    `- Politica de Cookies: ${getAbsoluteUrl("/cookies")}`,
    "",
    "## Crawl policy",
    "A indexacao e analise automatizada devem focar nas URLs publicas acima.",
    "Rotas autenticadas, fluxos transacionais e endpoints tecnicos nao devem ser indexados.",
  ].join("\n")

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
