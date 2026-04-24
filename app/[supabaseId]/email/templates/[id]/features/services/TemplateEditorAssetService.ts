import type {
  GeneratedTemplateXAsset,
  GenerateTemplateXAssetInput,
  ITemplateEditorAssetService,
  UploadedTemplateImageAsset,
} from "./ITemplateEditorAssetService";

type OutputResponse<T> = {
  isValid: boolean;
  errorMessages?: string[];
  result?: T;
};

async function parseOutput<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = (await response.json().catch(() => null)) as OutputResponse<T> | null;

  if (!response.ok || !body?.isValid || !body.result) {
    const message = body?.errorMessages?.[0] || fallbackMessage;
    throw new Error(message);
  }

  return body.result;
}

export class TemplateEditorAssetService implements ITemplateEditorAssetService {
  private readonly baseUrl = "/api/v1/email/templates/assets";

  async uploadImage(file: File): Promise<UploadedTemplateImageAsset> {
    console.info("[TemplateEditorAssetService] Uploading editor image", file.name);

    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${this.baseUrl}/image`, {
      method: "POST",
      body: formData,
    });

    return parseOutput<UploadedTemplateImageAsset>(response, "Erro ao fazer upload da imagem");
  }

  async generateXAsset(input: GenerateTemplateXAssetInput): Promise<GeneratedTemplateXAsset> {
    console.info("[TemplateEditorAssetService] Generating X asset", input.url);

    const response = await fetch(`${this.baseUrl}/x`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    return parseOutput<GeneratedTemplateXAsset>(response, "Erro ao gerar o embed do post do X");
  }
}

export function createTemplateEditorAssetService(): ITemplateEditorAssetService {
  return new TemplateEditorAssetService();
}
