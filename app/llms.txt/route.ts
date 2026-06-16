import { NextResponse } from "next/server"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import {
  getPublicResourcePath,
  getPublicResourceSlugs,
  PUBLIC_RESOURCES_HUB_PATH,
} from "@/lib/seo/publicResources"

export async function GET() {
  const resourceUrls = getPublicResourceSlugs().map((slug) =>
    `- ${getAbsoluteUrl(getPublicResourcePath(slug))}`,
  )

  const content = [
    "# Corretor Studio",
    "",
    "## Product",
    "Corretor Studio e uma plataforma SaaS de gestao comercial para corretores de planos de saude no Brasil.",
    "A plataforma centraliza CRM, pipeline, agenda de reunioes, operacao em equipe, integracoes e acompanhamento de conversao.",
    "",
    "## Audience",
    "- Corretores de planos de saude",
    "- Gestores comerciais de corretoras",
    "- Operadores SDR e Closer em times de vendas",
    "",
    "## Core capabilities",
    "- CRM e funil comercial com etapas de acompanhamento",
    "- Gestao de equipe comercial e distribuicao de trabalho",
    "- Integracoes para captacao e operacao comercial",
    "- Indicadores para analise de conversao e produtividade",
    "",
    "## Canonical public URLs",
    `- Home: ${getAbsoluteUrl("/")}`,
    `- Recursos: ${getAbsoluteUrl(PUBLIC_RESOURCES_HUB_PATH)}`,
    `- Assinatura: ${getAbsoluteUrl("/subscribe")}`,
    `- Politica de Privacidade: ${getAbsoluteUrl("/privacy-policy")}`,
    `- Termos de Uso: ${getAbsoluteUrl("/terms")}`,
    `- Politica de Cookies: ${getAbsoluteUrl("/cookies")}`,
    `- Sitemap: ${getAbsoluteUrl("/sitemap.xml")}`,
    `- Robots: ${getAbsoluteUrl("/robots.txt")}`,
    "",
    "## Resource URLs (SEO cluster)",
    ...resourceUrls,
    "",
    "## Crawl and indexing policy",
    "- Agentes de busca e IA devem priorizar as URLs canonicas publicas listadas acima.",
    "- Rotas autenticadas, fluxos transacionais e endpoints tecnicos nao devem ser indexados.",
    "- Para politica detalhada de permissao/bloqueio de crawl, siga robots.txt.",
    "",
    "## Freshness",
    "- Este arquivo pode ser atualizado periodicamente para refletir novas paginas publicas e capacidades.",
  ].join("\n")

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
