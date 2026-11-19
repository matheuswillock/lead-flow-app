import type { Metadata } from "next"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { EntregasContainer } from "./features/container/EntregasContainer"
import "./entregas.css"

export const metadata: Metadata = {
  ...createPublicPageMetadata({
    title: "Proposta de Assessoria Comercial · Corretor Studio",
    description: "Proposta de assessoria comercial para corretores de plano de saúde.",
    canonicalPath: "/entregas",
  }),
  robots: { index: false, follow: false },
}

export default function EntregasRoute() {
  return <EntregasContainer />
}
