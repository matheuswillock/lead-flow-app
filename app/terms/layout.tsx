import type { Metadata } from "next"
import { createPublicPageMetadata } from "@/lib/metadata/policies"

export const metadata: Metadata = createPublicPageMetadata({
  title: "Termos de Uso | Corretor Studio",
  description:
    "Leia os Termos de Uso do Corretor Studio, plataforma SaaS para gestao de leads, operacao comercial e acompanhamento de performance.",
  canonicalPath: "/terms",
  keywords: ["termos de uso corretor studio", "contrato saas corretor studio", "condicoes de uso crm"],
})

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children
}
