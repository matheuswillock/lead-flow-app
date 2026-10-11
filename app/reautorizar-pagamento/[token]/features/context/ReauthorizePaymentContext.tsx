"use client"

import { createContext, useContext } from "react"

const ReauthorizePaymentContext = createContext<null>(null)

export function ReauthorizePaymentProvider({ children }: { children: React.ReactNode }) {
  return <ReauthorizePaymentContext.Provider value={null}>{children}</ReauthorizePaymentContext.Provider>
}

export function useReauthorizePaymentContext() {
  return useContext(ReauthorizePaymentContext)
}
