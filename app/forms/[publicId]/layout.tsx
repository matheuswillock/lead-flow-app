"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { ForceLightDocument } from "./features/components/ForceLightDocument"

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-form-page light min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <ForceLightDocument />
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
