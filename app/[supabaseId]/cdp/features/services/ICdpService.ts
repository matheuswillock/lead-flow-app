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

export type CdpFieldOption = {
  key: string
  label: string
  sourceType: string
}

export interface ICdpService {
  syncCrm(supabaseId: string, teamId: string, body?: { leadId?: string }): Promise<CdpSyncResult>
  syncPortfolio(supabaseId: string, teamId: string): Promise<CdpSyncResult>
  syncEmail(supabaseId: string, teamId: string): Promise<CdpSyncResult>
  syncWhatsapp(supabaseId: string, teamId: string): Promise<CdpSyncResult>
  listProfiles(
    supabaseId: string,
    teamId: string,
    params: ListProfilesParams
  ): Promise<{
    items: CdpProfileListItem[]
    total: number
    page: number
    pageSize: number
  }>
  getProfile(supabaseId: string, teamId: string, id: string): Promise<CdpProfileDetail>
  listSegments(
    supabaseId: string,
    teamId: string
  ): Promise<{ segments: CdpSegment[]; metrics: CdpMetrics }>
  listSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segment: string,
    page: number,
    pageSize: number
  ): Promise<{ items: CdpProfileDetail[]; total: number }>
  listProfileEvents(
    supabaseId: string,
    teamId: string,
    profileId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: CdpProfileDetail["events"]; total: number }>
  listAvailableFields(supabaseId: string, teamId: string): Promise<CdpFieldOption[]>
  previewInterpolation(
    supabaseId: string,
    teamId: string,
    body: { profileId: string; variableKeys: string[] }
  ): Promise<{ values: Record<string, string> }>
}
