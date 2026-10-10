import type {
  AccountAccessDecision,
  AccountAccessRecord,
} from "@/app/api/shared/accountAccessDecision/types"

export interface IAccountAccessDecisionService {
  decide(account: AccountAccessRecord): AccountAccessDecision
}
