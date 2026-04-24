import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess";
import type { XEmbedTheme } from "@/lib/email-editor-embeds";

export interface UploadEmailTemplateImageResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  alt?: string;
  error?: string;
}

export interface GenerateEmailTemplateXAssetInput {
  url: string;
  theme: XEmbedTheme;
}

export interface GenerateEmailTemplateXAssetResult {
  success: boolean;
  html?: string;
  imageUrl?: string;
  canonicalUrl?: string;
  handle?: string;
  postId?: string;
  theme?: XEmbedTheme;
  error?: string;
}

export interface IEmailTemplateAssetService {
  uploadImage(file: File, ctx: TeamContext): Promise<UploadEmailTemplateImageResult>;
  generateXAsset(
    input: GenerateEmailTemplateXAssetInput,
    ctx: TeamContext
  ): Promise<GenerateEmailTemplateXAssetResult>;
}
