import type {
  CdpMetrics,
  CdpProfileDetail,
  CdpProfileListItem,
  CdpSegment,
  CdpSyncResult,
} from "../context/CdpTypes"

export type ListProfilesParams = {
  page: number
  pageSize: number
  search?: string
  consent?: string
  sourceType?: string
  segment?: string
}

export interface ICdpService {
  syncCrm(): Promise<CdpSyncResult>
  syncPortfolio(): Promise<CdpSyncResult>
  syncEmail(): Promise<CdpSyncResult>
  listProfiles(params: ListProfilesParams): Promise<{
    items: CdpProfileListItem[]
    total: number
    page: number
    pageSize: number
  }>
  getProfile(id: string): Promise<CdpProfileDetail>
  listSegments(): Promise<{ segments: CdpSegment[]; metrics: CdpMetrics }>
  listSegmentProfiles(
    segment: string,
    page: number,
    pageSize: number
  ): Promise<{ items: CdpProfileDetail[]; total: number }>
}
