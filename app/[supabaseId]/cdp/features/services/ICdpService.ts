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
  channel?: string
  segment?: string
  lastSeenFrom?: string
  lastSeenTo?: string
}

export interface ICdpService {
  syncCrm(body?: { leadId?: string }): Promise<CdpSyncResult>
  syncPortfolio(): Promise<CdpSyncResult>
  syncEmail(): Promise<CdpSyncResult>
  syncWhatsapp(): Promise<CdpSyncResult>
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
  listProfileEvents(
    profileId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: CdpProfileDetail["events"]; total: number }>
}
