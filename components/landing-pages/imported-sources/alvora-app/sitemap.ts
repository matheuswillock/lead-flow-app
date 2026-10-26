import type { MetadataRoute } from 'next'
import { getSiteUrl } from '../alvora-lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: `${getSiteUrl()}/`,
  }]
}
