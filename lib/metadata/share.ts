export const SHARE_SITE_NAME = "Corretor Studio"
export const SHARE_IMAGE_PATH = "/corretor-studio-share-v1.png"
export const SHARE_IMAGE_ALT = "Logo do Corretor Studio"
export const SHARE_IMAGE_WIDTH = 1200
export const SHARE_IMAGE_HEIGHT = 630
const DEFAULT_SITE_URL = "https://corretorstudio.com"

export function getMetadataBase(): URL | undefined {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!appUrl) {
    return undefined
  }

  try {
    return new URL(appUrl)
  } catch {
    return undefined
  }
}

export function getSiteUrl(): URL {
  const metadataBase = getMetadataBase()
  if (metadataBase) {
    return new URL(metadataBase.origin)
  }

  return new URL(DEFAULT_SITE_URL)
}

export function getAbsoluteUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`
  return new URL(normalizedPath, getSiteUrl()).toString()
}
