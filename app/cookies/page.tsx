import type { Metadata } from "next"
import { LegalDocumentPage } from "@/components/landing/LegalDocumentPage"

export const metadata: Metadata = {
  title: "Política de Cookies | Corretor Studio",
  description: "Política de Cookies da plataforma Corretor Studio.",
}

export default function CookiesPage() {
  return <LegalDocumentPage documentKey="cookies" />
}
