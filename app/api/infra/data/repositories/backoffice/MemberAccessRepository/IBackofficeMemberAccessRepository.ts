export interface BackofficeMemberAccessProfileRecord {
  profileId: string
  supabaseId: string | null
  email: string
  fullName: string | null
  role: "manager" | "backoffice" | "operator"
  isMaster: boolean
  managerName: string | null
}

export interface IBackofficeMemberAccessRepository {
  findProfileAccessRecord(profileId: string): Promise<BackofficeMemberAccessProfileRecord | null>
}
