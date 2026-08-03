import { shortLinkService } from "@/app/api/services/shortLink/ShortLinkService"
import { Output } from "@/lib/output"
import { getAppUrl } from "@/lib/utils/app-url"

export class ShortLinkUseCase {
  async getOrCreate(targetUrl: string): Promise<Output> {
    try {
      const appUrl = getAppUrl({ removeTrailingSlash: true })
      if (!targetUrl.startsWith(appUrl)) {
        return new Output(false, [], ["URL de destino inválida."], null)
      }
      const shortUrl = await shortLinkService.getOrCreate({ targetUrl })
      return new Output(true, ["Link encurtado com sucesso."], [], { shortUrl })
    } catch (error) {
      console.error("[ShortLinkUseCase][getOrCreate]", error)
      return new Output(false, [], ["Erro ao encurtar link."], null)
    }
  }
}

export const shortLinkUseCase = new ShortLinkUseCase()
