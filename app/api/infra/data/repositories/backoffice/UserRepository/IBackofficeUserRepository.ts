import type { BackofficeUser, Profile } from "@prisma/client"
import type { GoogleOAuthConnection } from "@prisma/client"

export interface CreateBackofficeUserInput {
  id: string
  profileId: string
  email: string
  fullAccess?: boolean
  isSdr?: boolean
  isCloser?: boolean
  createdByProfileId?: string
}

export interface UpdateBackofficeUserInput {
  email?: string
  isActive?: boolean
  fullAccess?: boolean
  isSdr?: boolean
  isCloser?: boolean
  googleConnectionId?: string | null
  linkedCorretorStudioProfileId?: string | null
  timezone?: string
  mailboxStatus?: string
  mailboxAddress?: string
  mailboxProvisionedAt?: Date
}

export type BackofficeUserWithProfile = BackofficeUser & {
  profile: Pick<Profile, "fullName" | "email">
  googleConnection: Pick<GoogleOAuthConnection, "refreshToken" | "revokedAt" | "googleEmail"> | null
  linkedCorretorStudioProfile: {
    googleConnection: Pick<GoogleOAuthConnection, "refreshToken" | "revokedAt" | "googleEmail"> | null
  } | null
}

export type BackofficeUserWithGoogleContext = BackofficeUser & {
  googleConnection: GoogleOAuthConnection | null
  linkedCorretorStudioProfile: {
    googleConnection: GoogleOAuthConnection | null
  } | null
}

export type BackofficeUserConnectionDependent = Pick<BackofficeUser, "id" | "email" | "profileId">;

export interface IBackofficeUserRepository {
  create(data: CreateBackofficeUserInput): Promise<BackofficeUser>
  findMany(params?: { isActive?: boolean }): Promise<BackofficeUserWithProfile[]>
  findById(id: string): Promise<BackofficeUser | null>
  findManyByIds(ids: string[]): Promise<BackofficeUser[]>
  findByEmail(email: string): Promise<BackofficeUser | null>
  findByProfileId(profileId: string): Promise<BackofficeUser | null>
  findByIdWithGoogleContext(id: string): Promise<BackofficeUserWithGoogleContext | null>
  findManyByIdsWithGoogleContext(ids: string[]): Promise<BackofficeUserWithGoogleContext[]>
  findByGoogleConnectionId(googleConnectionId: string): Promise<BackofficeUserConnectionDependent[]>
  findByLinkedProfileId(profileId: string): Promise<BackofficeUserConnectionDependent[]>
  findLinkedDependentsWithoutOwnConnection(profileId: string): Promise<BackofficeUserConnectionDependent[]>
  update(id: string, data: UpdateBackofficeUserInput): Promise<BackofficeUser>
}
