import type { Metadata } from "next"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { PrimePage } from "./PrimePage"

export const metadata: Metadata = createPublicPageMetadata({
  title: "Prime — Onside | Backstage Club",
  description:
    "100 dias de imersão total na construção de uma operação comercial previsível, lucrativa e que não escraviza o dono.",
  canonicalPath: "/prime",
  keywords: ["prime onside", "backstage club", "operação comercial", "sdr corretor", "corretor studio prime"],
})

export default function PrimeRoute() {
  return <PrimePage />
}
