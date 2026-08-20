import type {
  RadarCustomSegment,
  RadarCustomSegmentListItem,
  RadarListSegmentsResult,
  RadarProfileDetail,
  RadarProfileListItem,
  RadarProfileContracts,
  RadarProfileTouchpoints,
  RadarSegmentDeleteResult,
  RadarSegmentRules,
  RadarSyncResult,
} from "../context/RadarTypes"
import type { RadarProfileForms } from "@/lib/radar/profile-forms"

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
  sort?: "engagementScore" | "lastSeenAt"
  order?: "asc" | "desc"
}

export type ExportProfilesParams = {
  search?: string
  consent?: string
  sourceType?: string
  channel?: string
  lastSeenFrom?: string
  lastSeenTo?: string
}

export type RadarExportResult = {
  rows: Array<Record<string, string>>
  total: number
  exported: number
  truncated: boolean
  maxRows: number
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
  exportProfiles(
    supabaseId: string,
    teamId: string,
    params: ExportProfilesParams
  ): Promise<RadarExportResult>
  exportSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segment: string
  ): Promise<RadarExportResult>
  exportCustomSegmentProfiles(
    supabaseId: string,
    teamId: string,
    segmentId: string
  ): Promise<RadarExportResult>
  getProfile(supabaseId: string, teamId: string, id: string): Promise<RadarProfileDetail>
  updateProfileGender(
    supabaseId: string,
    teamId: string,
    profileId: string,
    gender: "male" | "female" | "unknown"
  ): Promise<{ id: string; gender: string; genderSource: string }>
  promoteProfileToLead(
    supabaseId: string,
    teamId: string,
    profileId: string
  ): Promise<{ leadId: string; radarProfileId: string }>
  listSegments(supabaseId: string, teamId: string): Promise<RadarListSegmentsResult>
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
  listAvailableEventTypes(supabaseId: string, teamId: string): Promise<string[]>
  listAvailableCampaigns(
    supabaseId: string,
    teamId: string
  ): Promise<Array<{ id: string; name: string }>>
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
  previewSegmentWithHierarchy(
    supabaseId: string,
    teamId: string,
    input: {
      rules?: RadarSegmentRules
      parentSegmentId?: string
      campaignId?: string
    }
  ): Promise<{ count: number; totalConditions: number; previewProfiles: RadarProfileDetail[] }>
  createSegmentFromCampaign(
    supabaseId: string,
    teamId: string,
    input: {
      campaignId: string
      name: string
      description?: string | null
      additionalRules?: RadarSegmentRules
    }
  ): Promise<{ segmentId: string; name: string; totalConditions: number }>
  createChildSegment(
    supabaseId: string,
    teamId: string,
    input: {
      parentSegmentId: string
      name: string
      description?: string | null
      childRules: RadarSegmentRules
    }
  ): Promise<{ segmentId: string; name: string; parentName: string; totalConditions: number }>
  getProfileTouchpoints(supabaseId: string, teamId: string, profileId: string): Promise<RadarProfileTouchpoints>
  getProfileForms(supabaseId: string, teamId: string, profileId: string): Promise<RadarProfileForms>
  getProfileContracts(supabaseId: string, teamId: string, profileId: string): Promise<RadarProfileContracts>
  materializeContactList(
    supabaseId: string,
    teamId: string,
    segmentSlug: string,
    name?: string
  ): Promise<{ listId: string; totalContacts: number }>
  previewSegmentContactList(
    supabaseId: string,
    teamId: string,
    segmentSlug: string,
    variant: "system" | "custom"
  ): Promise<{ estimatedCount: number }>
  materializeSegmentToContactList(
    supabaseId: string,
    teamId: string,
    segmentSlug: string,
    variant: "system" | "custom"
  ): Promise<{ listId: string; contactCount: number }>
}
