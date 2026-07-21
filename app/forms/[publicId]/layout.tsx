"use client"

import { ThemeProvider } from "@/components/theme-provider"

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="light" style={{ colorScheme: "light" }}>
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
