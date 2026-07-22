import type { Metadata } from "next"
import { Suspense } from "react"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "./context/AuthContext"
import { TimezoneProvider } from "./context/TimezoneContext"
import { Toaster } from "sonner";
import {
  getAbsoluteUrl,
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
  alternates: {
    canonical: getAbsoluteUrl("/"),
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: appTitle,
    description: appDescription,
    url: getAbsoluteUrl("/"),
    siteName: SHARE_SITE_NAME,
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: getAbsoluteUrl(SHARE_IMAGE_PATH),
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
    images: [getAbsoluteUrl(SHARE_IMAGE_PATH)],
  },
  icons: {
    icon: "/corretor-studio-icon.svg",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <AuthProvider>
              <TimezoneProvider>
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
              </TimezoneProvider>
            </AuthProvider>
          </Suspense>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
