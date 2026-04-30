import type {
  BackofficeLead,
  BackofficeLeadOrigin,
  BackofficeLeadStatus,
  BackofficeUser,
  Profile,
} from "@prisma/client"

export type BackofficeLeadUserRelation = Pick<
  BackofficeUser,
  "id" | "email" | "isActive" | "isSdr" | "isCloser"
> & {
  profile: Pick<Profile, "fullName" | "email">
}

export type BackofficeLeadWithRelations = BackofficeLead & {
  sdrBackofficeUser: BackofficeLeadUserRelation | null
  closerBackofficeUser: BackofficeLeadUserRelation | null
}

export interface CreateBackofficeLeadInput {
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  status?: BackofficeLeadStatus
  origin?: BackofficeLeadOrigin
  sourceExternalId?: string | null
  sourceWebhookEventId?: string | null
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  meetingDate?: Date | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
  createdByProfileId?: string | null
}

export interface UpdateBackofficeLeadInput {
  name?: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  meetingDate?: Date | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
}

export interface UpdateBackofficeLeadStatusInput {
  status: BackofficeLeadStatus
  closerBackofficeUserId?: string | null
  meetingDate?: Date | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
}

export interface ListBackofficeLeadsParams {
  status?: BackofficeLeadStatus
}

export interface IBackofficeLeadRepository {
  create(data: CreateBackofficeLeadInput): Promise<BackofficeLeadWithRelations>
  findMany(params?: ListBackofficeLeadsParams): Promise<BackofficeLeadWithRelations[]>
  findById(id: string): Promise<BackofficeLeadWithRelations | null>
  findBySourceExternalId(sourceExternalId: string): Promise<BackofficeLeadWithRelations | null>
  update(id: string, data: UpdateBackofficeLeadInput): Promise<BackofficeLeadWithRelations>
  updateStatus(id: string, data: UpdateBackofficeLeadStatusInput): Promise<BackofficeLeadWithRelations>
  delete(id: string): Promise<void>
}
