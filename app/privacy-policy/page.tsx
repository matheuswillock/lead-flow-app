import type { Metadata } from "next"
import { LegalDocumentPage } from "@/components/landing/LegalDocumentPage"

export const metadata: Metadata = {
  title: "Política de Privacidade | Corretor Studio",
  description: "Política de Privacidade da plataforma Corretor Studio.",
}

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage documentKey="privacy" />
}
