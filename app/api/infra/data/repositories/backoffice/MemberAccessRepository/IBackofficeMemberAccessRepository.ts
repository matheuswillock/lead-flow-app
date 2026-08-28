export interface BackofficeMemberAccessProfileRecord {
  profileId: string
  supabaseId: string | null
  email: string
  fullName: string | null
  role: "manager" | "backoffice" | "operator"
  isMaster: boolean
  managerName: string | null
}

export type BackofficeInviteLockOutcome<T> =
  | { acquired: false }
  | { acquired: true; result: T }

export interface IBackofficeMemberAccessRepository {
  findProfileAccessRecord(profileId: string): Promise<BackofficeMemberAccessProfileRecord | null>
  /**
   * Serializa geração de link (convite/reset) por `profileId` — ver
   * `BackofficeMemberAccessRepository.runWithInviteLock` para o motivo
   * (duas gerações concorrentes se invalidam mutuamente).
   */
  runWithInviteLock<T>(
    profileId: string,
    work: () => Promise<T>
  ): Promise<BackofficeInviteLockOutcome<T>>
}
