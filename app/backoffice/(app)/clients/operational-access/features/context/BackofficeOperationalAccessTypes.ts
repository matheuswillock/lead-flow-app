export interface OperationalAccessActor {
  id: string
  fullName: string
  email: string
}

export interface OperationalAccessProfile {
  id: string
  fullName: string
  email: string
  isMaster: boolean
}

export interface OperationalAccessTeam {
  id: string
  name: string
  masterId: string
  master: OperationalAccessProfile
}

export interface OperationalAccessGrantItem {
  id: string
  capability: "ASSOCIADOS_QUEUE" | "MULTISKILL_TRANSFER_ORIGIN"
  profileId: string | null
  teamId: string | null
  isActive: boolean
  notes: string | null
  grantedAt: string
  revokedAt: string | null
  profile: OperationalAccessProfile | null
  team: OperationalAccessTeam | null
  grantedBy: OperationalAccessActor | null
  revokedBy: OperationalAccessActor | null
}

export interface OperationalAccessListResult {
  associadosQueue: OperationalAccessGrantItem[]
  multiskillOrigins: OperationalAccessGrantItem[]
  eligibleAssociadosProfiles: OperationalAccessProfile[]
  eligibleMultiskillMasters: OperationalAccessProfile[]
}

export interface IBackofficeOperationalAccessState {
  associadosQueue: OperationalAccessGrantItem[]
  multiskillOrigins: OperationalAccessGrantItem[]
  eligibleAssociadosProfiles: OperationalAccessProfile[]
  eligibleMultiskillMasters: OperationalAccessProfile[]
  isLoading: boolean
  error: string | null
  isGrantingAssociados: boolean
  isGrantingMultiskill: boolean
  isRevokingId: string | null
}

export interface IBackofficeOperationalAccessActions {
  fetchItems: () => Promise<void>
  grantAssociados: (profileId: string, notes?: string | null) => Promise<boolean>
  grantMultiskill: (masterId: string, notes?: string | null) => Promise<boolean>
  revoke: (grantId: string) => Promise<boolean>
}

export type IBackofficeOperationalAccessContext = IBackofficeOperationalAccessState &
  IBackofficeOperationalAccessActions
