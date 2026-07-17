import type { DescadastroState } from "./DescadastroTypes"
import { initialDescadastroState } from "./DescadastroTypes"

export function createInitialDescadastroState(): DescadastroState {
  return { ...initialDescadastroState }
}
