"use client"

import { ThemeProvider } from "@/components/theme-provider"

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-form-page light min-h-screen" style={{ colorScheme: "light" }}>
      <ThemeProvider
        attribute="class"
        forcedTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </div>
  )
}
