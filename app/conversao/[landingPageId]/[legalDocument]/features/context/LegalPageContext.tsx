import { createContext, useContext } from "react"
import type { PublicLegalDocument } from "./LegalPageTypes"
const LegalPageContext = createContext<PublicLegalDocument | null>(null)
export function LegalPageProvider({ value, children }: { value: PublicLegalDocument; children: React.ReactNode }) { return <LegalPageContext.Provider value={value}>{children}</LegalPageContext.Provider> }
export function useLegalPage() { const value = useContext(LegalPageContext); if (!value) throw new Error("LegalPageContext ausente"); return value }
