import type { Metadata } from "next"
import { LegalDocumentPage } from "@/components/landing/LegalDocumentPage"

export const metadata: Metadata = {
  title: "Termos de Uso | Corretor Studio",
  description: "Termos de Uso da plataforma Corretor Studio.",
}

export default function TermsPage() {
  return <LegalDocumentPage documentKey="terms" />
}
