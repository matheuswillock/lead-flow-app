import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess";
import {
  buildXWidgetEmbedHtml,
  deriveImageAltText,
  EMAIL_TEMPLATE_ASSET_MIME_TYPES,
  parseXPostUrl,
  sanitizeXDescription,
  type XEmbedTheme,
  USER_UPLOAD_IMAGE_MIME_TYPES,
} from "@/lib/email-editor-embeds";
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage";
import type {
  GenerateEmailTemplateXAssetInput,
  GenerateEmailTemplateXAssetResult,
  IEmailTemplateAssetService,
  UploadEmailTemplateImageResult,
} from "./IEmailTemplateAssetService";

const EXTERNAL_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  accept: "text/html,application/json,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8",
} as const;

type XOEmbedResponse = {
  author_name?: string;
  html?: string;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtmlTags(value: string) {
  return sanitizeXDescription(value.replace(/<[^>]+>/g, " "));
}

function extractMetaContent(html: string, names: string[]) {
  for (const name of names) {
    const escapedName = escapeRegex(name);
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["'][^>]*>`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return sanitizeXDescription(match[1]);
      }
    }
  }

  return null;
}

async function fetchText(url: string) {
  try {
    const response = await fetch(url, {
      headers: EXTERNAL_FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error("[EmailTemplateAssetService] Failed to fetch text asset", { url, error });
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: EXTERNAL_FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("[EmailTemplateAssetService] Failed to fetch json asset", { url, error });
    return null;
  }
}

async function downloadImageAsDataUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: EXTERNAL_FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return null;
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    if (!mimeType.startsWith("image/")) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.error("[EmailTemplateAssetService] Failed to download external image", { url, error });
    return null;
  }
}

function extractTweetTextFromOEmbedHtml(value: string | undefined) {
  if (!value) {
    return "";
  }

  const paragraphMatch = value.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return paragraphMatch?.[1] ? stripHtmlTags(paragraphMatch[1]) : "";
}

function wrapSvgText(text: string, maxCharsPerLine: number, maxLines: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word.slice(0, maxCharsPerLine));
      currentLine = word.slice(maxCharsPerLine);
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine.length > 0) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  if (lines.length === maxLines && words.length > 0) {
    const consumedLength = lines.join(" ").length;
    if (normalized.length > consumedLength && !lines[maxLines - 1].endsWith("...")) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[. ]+$/g, "")}...`;
    }
  }

  return lines;
}

function buildXAssetSvg({
  theme,
  handle,
  displayName,
  postId,
  caption,
  imageDataUrl,
}: {
  theme: XEmbedTheme;
  handle: string;
  displayName: string;
  postId: string;
  caption: string;
  imageDataUrl: string | null;
}) {
  const palette =
    theme === "dark"
      ? {
          background: "#10141c",
          card: "#1c2430",
          border: "#2d3948",
          text: "#f8fafc",
          muted: "#9aa9bd",
          avatar: "#334155",
          media: "#0f172a",
        }
      : {
          background: "#f4f7fb",
          card: "#ffffff",
          border: "#d7dee8",
          text: "#111827",
          muted: "#5b6b83",
          avatar: "#e7edf5",
          media: "#eef3f8",
        };

  const lines = wrapSvgText(caption || "Open this post on X to view the latest media and replies.", 40, 4);
  const textStartY = 126;
  const textLineHeight = 30;
  const textBlockHeight = Math.max(lines.length, 1) * textLineHeight;
  const mediaY = textStartY + textBlockHeight + 24;
  const mediaHeight = imageDataUrl ? 300 : 144;
  const totalHeight = mediaY + mediaHeight + 32;
  const clipId = `clip-${postId}-${theme}`;
  const escapedDisplayName = escapeXml(displayName || handle);
  const escapedHandle = escapeXml(`@${handle}`);
  const escapedLines = (lines.length > 0 ? lines : ["Open this post on X to view the latest media and replies."]).map(
    (line) => escapeXml(line)
  );

  const captionMarkup = escapedLines
    .map(
      (line, index) =>
        `<text x="36" y="${textStartY + index * textLineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${palette.text}" font-weight="500">${line}</text>`
    )
    .join("");

  const mediaMarkup = imageDataUrl
    ? `
    <rect x="24" y="${mediaY}" width="502" height="${mediaHeight}" rx="18" fill="${palette.media}" />
    <clipPath id="${clipId}">
      <rect x="24" y="${mediaY}" width="502" height="${mediaHeight}" rx="18" />
    </clipPath>
    <image href="${imageDataUrl}" x="24" y="${mediaY}" width="502" height="${mediaHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`
    : `
    <rect x="24" y="${mediaY}" width="502" height="${mediaHeight}" rx="18" fill="${palette.media}" />
    <text x="275" y="${mediaY + 58}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="${palette.muted}" font-weight="700">POST PREVIEW</text>
    <text x="275" y="${mediaY + 94}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${palette.text}" font-weight="700">Status ${escapeXml(postId)}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="550" height="${totalHeight}" viewBox="0 0 550 ${totalHeight}" fill="none">
  <rect width="550" height="${totalHeight}" rx="28" fill="${palette.background}" />
  <rect x="12" y="12" width="526" height="${totalHeight - 24}" rx="22" fill="${palette.card}" stroke="${palette.border}" stroke-width="2" />
  <circle cx="56" cy="56" r="20" fill="${palette.avatar}" />
  <text x="56" y="63" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="${palette.text}" font-weight="700">${escapeXml(
    handle.slice(0, 1).toUpperCase()
  )}</text>
  <text x="88" y="50" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="${palette.text}" font-weight="700">${escapedDisplayName}</text>
  <text x="88" y="72" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="${palette.muted}">${escapedHandle}</text>
  <text x="502" y="58" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${palette.text}" text-anchor="end">𝕏</text>
  ${captionMarkup}
  ${mediaMarkup}
</svg>`;
}

function buildXOEmbedUrl(url: string, theme: XEmbedTheme) {
  const query = new URLSearchParams({
    url,
    theme,
    omit_script: "true",
    dnt: "true",
    align: "none",
    maxwidth: "550",
  });

  return `https://publish.x.com/oembed?${query.toString()}`;
}

export class EmailTemplateAssetService implements IEmailTemplateAssetService {
  async uploadImage(file: File, ctx: TeamContext): Promise<UploadEmailTemplateImageResult> {
    try {
      if (!USER_UPLOAD_IMAGE_MIME_TYPES.includes(file.type as (typeof USER_UPLOAD_IMAGE_MIME_TYPES)[number])) {
        return {
          success: false,
          error: "Tipo de imagem inválido. Use JPEG, PNG, WEBP ou GIF.",
        };
      }

      const uploadResult = await SupabaseStorageService.uploadFile(
        file,
        STORAGE_BUCKETS.EMAIL_TEMPLATE_ASSETS,
        `uploaded-images/${ctx.profileId}`,
        file.name,
        "template-image"
      );

      if (!uploadResult.success || !uploadResult.fileId || !uploadResult.publicUrl) {
        return {
          success: false,
          error: uploadResult.error || "Não foi possível fazer upload da imagem.",
        };
      }

      return {
        success: true,
        fileId: uploadResult.fileId,
        publicUrl: uploadResult.publicUrl,
        alt: deriveImageAltText(file.name),
      };
    } catch (error) {
      console.error("[EmailTemplateAssetService] Unexpected error on uploadImage", error);
      return { success: false, error: "Erro inesperado ao fazer upload da imagem." };
    }
  }

  async generateXAsset(
    input: GenerateEmailTemplateXAssetInput,
    _ctx: TeamContext
  ): Promise<GenerateEmailTemplateXAssetResult> {
    try {
      const parsedUrl = parseXPostUrl(input.url);
      if (!parsedUrl) {
        return { success: false, error: "URL do post do X inválida." };
      }

      const [pageHtml, oEmbed] = await Promise.all([
        fetchText(parsedUrl.canonicalUrl),
        fetchJson<XOEmbedResponse>(buildXOEmbedUrl(parsedUrl.canonicalUrl, input.theme)),
      ]);

      if (!oEmbed?.html?.trim()) {
        return {
          success: false,
          error: "Não foi possível obter o HTML oficial do embed do X.",
        };
      }

      const ogImageUrl = pageHtml ? extractMetaContent(pageHtml, ["og:image", "twitter:image"]) : null;
      const ogDescription = pageHtml ? extractMetaContent(pageHtml, ["og:description", "twitter:description"]) : null;
      const displayName = oEmbed.author_name?.trim() || parsedUrl.handle;
      const caption =
        sanitizeXDescription(extractTweetTextFromOEmbedHtml(oEmbed.html) || ogDescription) ||
        "Open this post on X to view the latest media and replies.";

      const imageDataUrl = ogImageUrl ? await downloadImageAsDataUrl(ogImageUrl) : null;
      const svgMarkup = buildXAssetSvg({
        theme: input.theme,
        handle: parsedUrl.handle,
        displayName,
        postId: parsedUrl.postId,
        caption,
        imageDataUrl,
      });

      const svgFile = new File(
        [svgMarkup],
        `${parsedUrl.handle}-${parsedUrl.postId}-${input.theme}.svg`,
        { type: "image/svg+xml" }
      );

      if (
        !EMAIL_TEMPLATE_ASSET_MIME_TYPES.includes(
          svgFile.type as (typeof EMAIL_TEMPLATE_ASSET_MIME_TYPES)[number]
        )
      ) {
        return { success: false, error: "Tipo de asset do X inválido." };
      }

      const uploadResult = await SupabaseStorageService.uploadFile(
        svgFile,
        STORAGE_BUCKETS.EMAIL_TEMPLATE_ASSETS,
        `x-embeds/${parsedUrl.postId}/${input.theme}`,
        svgFile.name,
        "x-embed"
      );

      if (!uploadResult.success || !uploadResult.publicUrl) {
        return {
          success: false,
          error: uploadResult.error || "Não foi possível gerar o card visual do post do X.",
        };
      }

      return {
        success: true,
        html: buildXWidgetEmbedHtml(oEmbed.html),
        imageUrl: uploadResult.publicUrl,
        canonicalUrl: parsedUrl.canonicalUrl,
        handle: parsedUrl.handle,
        postId: parsedUrl.postId,
        theme: input.theme,
      };
    } catch (error) {
      console.error("[EmailTemplateAssetService] Unexpected error on generateXAsset", error);
      return { success: false, error: "Erro inesperado ao gerar o embed do post do X." };
    }
  }
}

export const emailTemplateAssetService = new EmailTemplateAssetService();
