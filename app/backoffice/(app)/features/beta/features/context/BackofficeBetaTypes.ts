export interface RawBetaGrant {
  id: string
  profileId: string
  isActive: boolean
}

export interface BetaGrantItem {
  id: string
  profileId: string
  isActive: boolean
  profile: {
    id: string
    fullName: string | null
    email: string | null
  }
}

export interface BetaFeatureItem {
  id: string
  slug: string
  name: string
  grants: BetaGrantItem[]
}

export interface BetaClientItem {
  id: string
  fullName: string
  email: string
  profileIconUrl: string | null
}

export interface BetaClientSearchResult {
  items: BetaClientItem[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}
