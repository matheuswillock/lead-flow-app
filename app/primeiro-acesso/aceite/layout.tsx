import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aceite de documentos · Corretor Studio",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function AcceptanceLayout({ children }: { children: React.ReactNode }) {
  return children
}

