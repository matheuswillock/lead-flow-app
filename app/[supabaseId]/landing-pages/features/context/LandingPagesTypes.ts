export type LandingPageListItem = {
  id: string
  publicId: string
  publicFormId: string
  name: string
  status: "draft" | "published" | "archived"
  templateSlug: string
  offer: { enabled?: boolean; percentage?: number }
  createdAt: string
  updatedAt: string
}

export type LandingDomain = {
  id: string
  hostname: string
  status: "pending" | "verified" | "failed"
  verifiedAt: string | null
  lastCheckedAt: string | null
}

export type LandingPagesState = {
  items: LandingPageListItem[]
  domain: LandingDomain | null
  emailDomainName: string | null
  emailDomainStatus: string | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  publish: (id: string) => Promise<boolean>
  archive: (id: string) => Promise<boolean>
  connectDomain: (hostname: string) => Promise<boolean>
  verifyDomain: () => Promise<boolean>
}
