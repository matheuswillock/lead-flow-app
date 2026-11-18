import { useContext } from "react"
import { EntregasContext } from "./EntregasContext"

export function useEntregas() {
  const contexto = useContext(EntregasContext)
  if (!contexto) throw new Error("useEntregas precisa estar dentro de EntregasProvider")
  return contexto
}
