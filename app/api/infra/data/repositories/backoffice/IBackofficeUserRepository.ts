import type { BackofficeUser, Profile } from "@prisma/client"

export interface CreateBackofficeUserInput {
  id: string
  profileId: string
  email: string
  fullAccess?: boolean
  createdByProfileId?: string
}

export interface UpdateBackofficeUserInput {
  email?: string
  isActive?: boolean
  fullAccess?: boolean
  mailboxStatus?: string
  mailboxAddress?: string
  mailboxProvisionedAt?: Date
}

export type BackofficeUserWithProfile = BackofficeUser & {
  profile: Pick<Profile, "fullName" | "email">
}

export interface IBackofficeUserRepository {
  create(data: CreateBackofficeUserInput): Promise<BackofficeUser>
  findMany(params?: { isActive?: boolean }): Promise<BackofficeUserWithProfile[]>
  findById(id: string): Promise<BackofficeUser | null>
  findByEmail(email: string): Promise<BackofficeUser | null>
  findByProfileId(profileId: string): Promise<BackofficeUser | null>
  update(id: string, data: UpdateBackofficeUserInput): Promise<BackofficeUser>
}
