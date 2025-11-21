import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "./context/AuthContext"
import { Toaster } from "sonner";

export const metadata: Metadata = { title: "Corretor Studio", description: "Uma plataforma de gestão de leads para corretores de saúde" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">        
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster 
              position="top-center" 
              richColors 
              closeButton
              expand={true}
              toastOptions={{
                style: {
                  zIndex: 9999,
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
