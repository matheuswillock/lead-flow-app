import type { Metadata } from "next"
import { createPublicPageMetadata } from "@/lib/metadata/policies"

export const metadata: Metadata = createPublicPageMetadata({
  title: "Politica de Privacidade | Corretor Studio",
  description:
    "Conheca como o Corretor Studio coleta, utiliza e protege dados pessoais na plataforma de gestao de leads para corretores de saude.",
  canonicalPath: "/privacy-policy",
  keywords: ["politica de privacidade", "lgpd corretor studio", "dados pessoais corretor studio"],
})

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children
}
