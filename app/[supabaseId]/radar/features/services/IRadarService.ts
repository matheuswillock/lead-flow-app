import type {
  RadarCustomSegment,
  RadarCustomSegmentListItem,
  RadarMetrics,
  RadarProfileDetail,
  RadarProfileListItem,
  RadarProfileTouchpoints,
  RadarSegment,
  RadarSegmentDeleteResult,
  RadarSegmentRules,
  RadarSyncResult,
} from "../context/RadarTypes"

export type CustomSegmentInput = {
  name: string
  description?: string | null
  rules: RadarSegmentRules
}

export type CustomSegmentUpdateInput = {
  name?: string
  description?: string | null
  rules?: RadarSegmentRules
  isActive?: boolean
}

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

export type RadarFieldOption = {
  key: string
  label: string
  sourceType: string
}

export interface IRadarService {
  syncCrm(supabaseId: string, teamId: string, body?: { leadId?: string }): Promise<RadarSyncResult>
  syncPortfolio(supabaseId: string, teamId: string): Promise<RadarSyncResult>
  syncEmail(supabaseId: string, teamId: string): Promise<RadarSyncResult>
  syncWhatsapp(supabaseId: string, teamId: string): Promise<RadarSyncResult>
  listProfiles(
    supabaseId: string,
    teamId: string,
    params: ListProfilesParams
  ): Promise<{
    items: RadarProfileListItem[]
    total: number
    page: number
    pageSize: number
  }>
  getProfile(supabaseId: string, teamId: string, id: string): Promise<RadarProfileDetail>
  listSegments(
    supabaseId: string,
    teamId: string
  ): Promise<{ segments: RadarSegment[]; metrics: RadarMetrics }>
  listSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segment: string,
    page: number,
    pageSize: number
  ): Promise<{ items: RadarProfileDetail[]; total: number }>
  listProfileEvents(
    supabaseId: string,
    teamId: string,
    profileId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: RadarProfileDetail["events"]; total: number }>
  listAvailableFields(supabaseId: string, teamId: string): Promise<RadarFieldOption[]>
  previewInterpolation(
    supabaseId: string,
    teamId: string,
    body: { profileId: string; variableKeys: string[] }
  ): Promise<{ values: Record<string, string> }>
  listCustomSegments(supabaseId: string, teamId: string): Promise<RadarCustomSegmentListItem[]>
  createCustomSegment(
    supabaseId: string,
    teamId: string,
    input: CustomSegmentInput
  ): Promise<RadarCustomSegment>
  updateCustomSegment(
    supabaseId: string,
    teamId: string,
    segmentId: string,
    input: CustomSegmentUpdateInput
  ): Promise<RadarCustomSegment>
  deleteCustomSegment(
    supabaseId: string,
    teamId: string,
    segmentId: string
  ): Promise<RadarSegmentDeleteResult>
  listCustomSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segmentId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: RadarProfileDetail[]; total: number; page: number; pageSize: number }>
  previewCustomSegmentCount(
    supabaseId: string,
    teamId: string,
    rules: RadarSegmentRules
  ): Promise<{ count: number }>
  getProfileTouchpoints(supabaseId: string, teamId: string, profileId: string): Promise<RadarProfileTouchpoints>
}
