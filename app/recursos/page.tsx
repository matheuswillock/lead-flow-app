import type { Metadata } from "next"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { ResourcesProvider } from "./features/context/ResourcesContext"
import { ResourcesContainer } from "./features/container/ResourcesContainer"

export const metadata: Metadata = createPublicPageMetadata({
  title: "Recursos para corretores de saúde | Corretor Studio",
  description:
    "Central de conteúdo sobre CRM, pipeline comercial, gestão de equipe, integrações e produtividade para corretores de planos de saúde.",
  canonicalPath: "/recursos",
  keywords: [
    "recursos para corretor de saúde",
    "conteúdo CRM corretor",
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
