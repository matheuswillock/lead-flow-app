import type { IDescadastroService } from "./IDescadastroService"

export class DescadastroService implements IDescadastroService {
  getPreviewLabel(): string {
    return "Pré-visualização da página pública de descadastro"
  }
}

export const descadastroService = new DescadastroService()
