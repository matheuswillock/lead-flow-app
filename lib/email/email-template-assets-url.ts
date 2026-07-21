import { MARKETING_LAUNCH_ASSET_PREFIX } from "@/lib/email/email-template-assets"

const EMAIL_TEMPLATE_ASSETS_BUCKET =
  process.env.SUPABASE_EMAIL_TEMPLATE_ASSETS_BUCKET || "email-template-assets"

/**
 * Monta URL pública de um asset no bucket email-template-assets.
 * Uso server-side (API, scripts). Não importar em Client Components.
 */
export function buildEmailTemplateAssetPublicUrl(fileId: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!supabaseUrl) return null

  const normalizedPath = fileId.replace(/^\/+/, "")
  return `${supabaseUrl}/storage/v1/object/public/${EMAIL_TEMPLATE_ASSETS_BUCKET}/${normalizedPath}`
}

export function getMarketingLaunchAssetUrl(fileName: string): string | null {
  return buildEmailTemplateAssetPublicUrl(`${MARKETING_LAUNCH_ASSET_PREFIX}/${fileName}`)
}
