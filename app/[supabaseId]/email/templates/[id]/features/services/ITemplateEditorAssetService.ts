import type { XEmbedTheme } from "@/lib/email-editor-embeds";

export interface UploadedTemplateImageAsset {
  fileId: string;
  publicUrl: string;
  alt: string;
}

export interface GenerateTemplateXAssetInput {
  url: string;
  theme: XEmbedTheme;
}

export interface GeneratedTemplateXAsset {
  html: string;
  imageUrl: string;
  canonicalUrl: string;
  handle: string;
  postId: string;
  theme: XEmbedTheme;
}

export interface ITemplateEditorAssetService {
  uploadImage(file: File): Promise<UploadedTemplateImageAsset>;
  generateXAsset(input: GenerateTemplateXAssetInput): Promise<GeneratedTemplateXAsset>;
}
