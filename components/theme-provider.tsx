"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * next-themes injeta um <script> inline para evitar FOUC de tema.
 * No React 19 / Next.js 16 isso gera um console.error falso-positivo em
 * desenvolvimento ("Encountered a script tag while rendering...").
 * O script continua executando corretamente no SSR.
 *
 * @see https://github.com/shadcn-ui/ui/issues/10104
 */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    const first = args[0]
    if (
      typeof first === "string" &&
      first.includes("Encountered a script tag while rendering React component")
    ) {
      return
    }
    originalError.apply(console, args)
  }
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
