import { shortLinkService } from "@/app/api/services/shortLink/ShortLinkService"
import { Output } from "@/lib/output"

export class ShortLinkUseCase {
  async getOrCreate(targetUrl: string): Promise<Output> {
    try {
      const shortUrl = await shortLinkService.getOrCreate({ targetUrl })
      return new Output(true, ["Link encurtado com sucesso."], [], { shortUrl })
    } catch (error) {
      console.error("[ShortLinkUseCase][getOrCreate]", error)
      return new Output(false, [], ["Erro ao encurtar link."], null)
    }
  }
}

export const shortLinkUseCase = new ShortLinkUseCase()
