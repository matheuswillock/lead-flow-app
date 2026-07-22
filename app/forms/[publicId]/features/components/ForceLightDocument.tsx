"use client"

import { useEffect } from "react"

/**
 * Força o documentElement em light enquanto a rota pública de formulário
 * estiver montada. Complementa o opt-out CSS (`.public-form-page` fora de
 * `dark:`) e garante `color-scheme` / tokens no root durante a sessão.
 */
export function ForceLightDocument() {
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains("dark")
    const hadLight = root.classList.contains("light")
    const previousColorScheme = root.style.colorScheme

    root.classList.remove("dark")
    root.classList.add("light")
    root.style.colorScheme = "light"

    return () => {
      root.classList.remove("light")
      if (hadDark) {
        root.classList.add("dark")
      } else if (hadLight) {
        root.classList.add("light")
      }
      root.style.colorScheme = previousColorScheme
    }
  }, [])

  return null
}
