import type { Metadata } from "next"
import { createPublicPageMetadata } from "@/lib/metadata/policies"

export const metadata: Metadata = createPublicPageMetadata({
  title: "Politica de Cookies | Corretor Studio",
  description:
    "Saiba como o Corretor Studio utiliza cookies para melhorar a experiencia, analise de uso e funcionamento da plataforma.",
  canonicalPath: "/cookies",
  keywords: ["politica de cookies", "cookies corretor studio", "preferencias de cookies"],
})

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children
}
