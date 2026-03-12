export const SHARE_SITE_NAME = "Corretor Studio"
export const SHARE_IMAGE_PATH = "/corretor-studio-share-v1.png"
export const SHARE_IMAGE_ALT = "Logo do Corretor Studio"
export const SHARE_IMAGE_WIDTH = 1200
export const SHARE_IMAGE_HEIGHT = 630

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
