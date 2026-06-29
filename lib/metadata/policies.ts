import type { Metadata } from "next"
import {
  getAbsoluteUrl,
  getMetadataBase,
  SHARE_IMAGE_ALT,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_PATH,
  SHARE_IMAGE_WIDTH,
  SHARE_SITE_NAME,
} from "@/lib/metadata/share"

export const NO_INDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-image-preview": "none",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

interface PublicPageMetadataInput {
  title: string
  description: string
  canonicalPath: string
  keywords?: string[]
  ogType?: "website" | "article"
  publishedTime?: string
  modifiedTime?: string
}

export function createPublicPageMetadata({
  title,
  description,
  canonicalPath,
  keywords: _keywords,
  ogType = "website",
  publishedTime,
  modifiedTime,
}: PublicPageMetadataInput): Metadata {
  const absoluteCanonical = getAbsoluteUrl(canonicalPath)
  const absoluteShareImage = getAbsoluteUrl(SHARE_IMAGE_PATH)

  return {
    metadataBase: getMetadataBase(),
    title,
    description,
    alternates: {
      canonical: absoluteCanonical,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: absoluteCanonical,
      siteName: SHARE_SITE_NAME,
      locale: "pt_BR",
      type: ogType,
      publishedTime,
      modifiedTime,
      images: [
        {
          url: absoluteShareImage,
          width: SHARE_IMAGE_WIDTH,
          height: SHARE_IMAGE_HEIGHT,
          alt: SHARE_IMAGE_ALT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteShareImage],
    },
  }
}
