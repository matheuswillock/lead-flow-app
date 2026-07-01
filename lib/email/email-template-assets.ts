import { STORAGE_BUCKETS } from "@/lib/supabase/storage"

/**
 * Monta URL pública de um asset no bucket email-template-assets.
 * @param fileId Caminho completo no bucket (ex.: teamId/timestamp-random.png)
 */
export function buildEmailTemplateAssetPublicUrl(fileId: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!supabaseUrl) return null

  const bucket = STORAGE_BUCKETS.EMAIL_TEMPLATE_ASSETS
  const normalizedPath = fileId.replace(/^\/+/, "")
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${normalizedPath}`
}

export interface EmailTemplateAssetItem {
  fileId: string
  fileName: string
  publicUrl: string
  createdAt: string | null
}

/** Prefixo compartilhado para assets de campanhas de marketing */
export const MARKETING_LAUNCH_ASSET_PREFIX = "_shared/marketing-launch"

export function getMarketingLaunchAssetUrl(fileName: string): string | null {
  return buildEmailTemplateAssetPublicUrl(`${MARKETING_LAUNCH_ASSET_PREFIX}/${fileName}`)
}
