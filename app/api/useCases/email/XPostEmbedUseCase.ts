import { Output } from "@/lib/output"
import { xPostEmbedService } from "@/app/api/services/email/XPostEmbedService"

export class XPostEmbedUseCase {
  constructor(private readonly service = xPostEmbedService) {}

  async execute(rawUrl: string): Promise<Output> {
    const url = rawUrl?.trim()
    if (!url) {
      return new Output(false, [], ["URL do post é obrigatória"], null)
    }

    try {
      const result = await this.service.resolveFromUrl(url)
      return new Output(true, ["Post do X convertido com sucesso"], [], result)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao converter post do X"
      return new Output(false, [], [message], null)
    }
  }
}

export const xPostEmbedUseCase = new XPostEmbedUseCase()
