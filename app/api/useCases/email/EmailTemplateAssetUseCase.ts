import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess";
import { Output } from "@/lib/output";
import type { XEmbedTheme } from "@/lib/email-editor-embeds";
import {
  emailTemplateAssetService,
} from "@/app/api/services/EmailTemplateAsset/EmailTemplateAssetService";
import type { IEmailTemplateAssetService } from "@/app/api/services/EmailTemplateAsset/IEmailTemplateAssetService";

export interface GenerateTemplateXAssetInput {
  url: string;
  theme: XEmbedTheme;
}

export class EmailTemplateAssetUseCase {
  constructor(private readonly assetService: IEmailTemplateAssetService = emailTemplateAssetService) {}

  async uploadImage(file: File, ctx: TeamContext): Promise<Output> {
    try {
      const result = await this.assetService.uploadImage(file, ctx);

      if (!result.success || !result.fileId || !result.publicUrl || !result.alt) {
        return new Output(false, [], [result.error || "Não foi possível fazer upload da imagem"], null);
      }

      return new Output(true, ["Imagem enviada com sucesso"], [], {
        fileId: result.fileId,
        publicUrl: result.publicUrl,
        alt: result.alt,
      });
    } catch (error) {
      console.error("[EmailTemplateAssetUseCase][uploadImage]", error);
      return new Output(false, [], ["Erro ao fazer upload da imagem"], null);
    }
  }

  async generateXAsset(input: GenerateTemplateXAssetInput, ctx: TeamContext): Promise<Output> {
    try {
      const result = await this.assetService.generateXAsset(input, ctx);

      if (
        !result.success ||
        !result.html ||
        !result.imageUrl ||
        !result.canonicalUrl ||
        !result.handle ||
        !result.postId ||
        !result.theme
      ) {
        return new Output(false, [], [result.error || "Não foi possível gerar o embed do post do X"], null);
      }

      return new Output(true, ["Embed do post do X gerado com sucesso"], [], {
        html: result.html,
        imageUrl: result.imageUrl,
        canonicalUrl: result.canonicalUrl,
        handle: result.handle,
        postId: result.postId,
        theme: result.theme,
      });
    } catch (error) {
      console.error("[EmailTemplateAssetUseCase][generateXAsset]", error);
      return new Output(false, [], ["Erro ao gerar o embed do post do X"], null);
    }
  }
}
