import type { OperationalAccessGrantItem, OperationalAccessListResult } from "../context/BackofficeOperationalAccessTypes"

export interface IBackofficeOperationalAccessService {
  list(): Promise<OperationalAccessListResult>
  grantAssociados(profileId: string, notes?: string | null): Promise<OperationalAccessGrantItem>
  grantMultiskill(masterId: string, notes?: string | null): Promise<OperationalAccessGrantItem>
  revoke(grantId: string): Promise<OperationalAccessGrantItem>
}
