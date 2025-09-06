import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = { title: "Lead Flow", description: "Pré-CRM para corretores de saúde" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  )
}
