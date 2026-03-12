import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "./context/AuthContext"
import { Toaster } from "sonner";
import {
  getMetadataBase,
  SHARE_IMAGE_ALT,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_PATH,
  SHARE_IMAGE_WIDTH,
  SHARE_SITE_NAME,
} from "@/lib/metadata/share"

const appTitle = "Corretor Studio"
const appDescription = "Uma plataforma de gestão de leads para corretores de saúde"

export const metadata: Metadata = { 
  metadataBase: getMetadataBase(),
  title: appTitle, 
  description: appDescription,
  openGraph: {
    title: appTitle,
    description: appDescription,
    url: "/",
    siteName: SHARE_SITE_NAME,
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: SHARE_IMAGE_PATH,
        width: SHARE_IMAGE_WIDTH,
        height: SHARE_IMAGE_HEIGHT,
        alt: SHARE_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: appTitle,
    description: appDescription,
    images: [SHARE_IMAGE_PATH],
  },
  icons: {
    icon: '/corretor-studio-icon.svg',
  }
}

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
