"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { createInitialDescadastroState } from "./DescadastroHook"
import type { DescadastroState } from "./DescadastroTypes"

type DescadastroContextValue = DescadastroState & {
  setPreviewMode: (mode: DescadastroState["previewMode"]) => void
}

const DescadastroContext = createContext<DescadastroContextValue | null>(null)

export function DescadastroProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createInitialDescadastroState)

  const value = useMemo(
    () => ({
      ...state,
      setPreviewMode: (previewMode: DescadastroState["previewMode"]) => {
        setState((current) => ({ ...current, previewMode }))
      },
    }),
    [state]
  )

  return <DescadastroContext.Provider value={value}>{children}</DescadastroContext.Provider>
}

export function useDescadastroContext() {
  const context = useContext(DescadastroContext)
  if (!context) {
    throw new Error("useDescadastroContext deve ser usado dentro de DescadastroProvider")
  }
  return context
}
