import type { Metadata } from "next"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { ResourcesProvider } from "./features/context/ResourcesContext"
import { ResourcesContainer } from "./features/container/ResourcesContainer"

export const metadata: Metadata = createPublicPageMetadata({
  title: "Recursos para corretores de saude | Corretor Studio",
  description:
    "Central de conteudo sobre CRM, pipeline comercial, gestao de equipe, integracoes e produtividade para corretores de planos de saude.",
  canonicalPath: "/recursos",
  keywords: [
    "recursos para corretor de saude",
    "conteudo crm corretor",
    "guia pipeline comercial",
    "faq corretor studio",
  ],
})

export default function RecursosPage() {
  return (
    <ResourcesProvider>
      <ResourcesContainer />
    </ResourcesProvider>
  )
}
