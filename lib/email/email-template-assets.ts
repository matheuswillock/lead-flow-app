export interface EmailTemplateAssetItem {
  fileId: string
  fileName: string
  publicUrl: string
  createdAt: string | null
}

export const EMAIL_TEMPLATE_ASSET_MAX_BYTES = 2 * 1024 * 1024
export const EMAIL_TEMPLATE_ASSET_MAX_SIZE_MB = "2"
export const EMAIL_TEMPLATE_ASSET_ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const

export function validateEmailTemplateAssetFile(file: File): string | null {
  if (
    !EMAIL_TEMPLATE_ASSET_ACCEPTED_MIME_TYPES.includes(
      file.type as (typeof EMAIL_TEMPLATE_ASSET_ACCEPTED_MIME_TYPES)[number]
    )
  ) {
    return "Tipo de arquivo não permitido. Use PNG, JPG ou WebP."
  }

  if (file.size > EMAIL_TEMPLATE_ASSET_MAX_BYTES) {
    return `Arquivo muito grande. Tamanho máximo: ${EMAIL_TEMPLATE_ASSET_MAX_SIZE_MB} MB`
  }

  return null
}

/** Prefixo compartilhado para assets de campanhas de marketing */
export const MARKETING_LAUNCH_ASSET_PREFIX = "_shared/marketing-launch"
