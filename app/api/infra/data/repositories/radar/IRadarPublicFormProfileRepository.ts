import type { Prisma, RadarIdentityType } from "@prisma/client"

export type RadarPublicFormResolvedProfile = {
  profile: { id: string }
  wasExisting: boolean
}

export interface IRadarPublicFormProfileRepository {
  findProfileByIdentity(
    teamId: string,
    type: RadarIdentityType,
    normalizedValue: string,
  ): Promise<{ profileId: string } | null>
  resolveProfileForVisitorSession(input: {
    teamId: string
    visitorSession: string
    lastSeenAt?: Date
  }): Promise<RadarPublicFormResolvedProfile>
  resolveProfileForEmail(input: {
    teamId: string
    normalizedEmail: string
    emailValue: string
    displayName: string | null
    normalizedName: string | null
    emailSource: string
    lastSeenAt?: Date
  }): Promise<RadarPublicFormResolvedProfile>
  resolveProfileForPhone(input: {
    teamId: string
    normalizedPhone: string
    normalizedName: string
    displayName: string
    displayPhone: string
    phoneValue: string | null
    phoneSource: string
    primaryEmail?: string | null
    normalizedPrimaryEmail?: string | null
    lastSeenAt?: Date
  }): Promise<RadarPublicFormResolvedProfile>
  applyFormAnswerDisplayName(profileId: string, teamId: string, displayName: string): Promise<void>
  appendEventIfNewBySourceKey(input: {
    profileId: string
    teamId: string
    eventType: string
    sourceType: string
    sourceId: string
    occurredAt: Date
    metadata?: Prisma.InputJsonValue
  }): Promise<{ id: string } | null>
}

export interface IRadarProfileMergeRepository {
  mergePublicFormProfiles(
    teamId: string,
    losingProfileId: string,
    winningProfileId: string,
  ): Promise<{ winningProfileId: string; merged: boolean; conflict: boolean }>
}
