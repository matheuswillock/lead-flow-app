import {
  MEMBER_PRO_ACCESS_DAYS,
  resolveMemberProAccessWindow,
} from "@/app/api/shared/billing/memberProBillingRules"

export type MemberProAccessWindowRepairInput = {
  sourceStart: Date
  currentAccessStartsAt: Date | null
  currentAccessExpiresAt: Date | null
}

export type MemberProAccessWindowRepairResult = {
  accessStartsAt: Date
  accessExpiresAt: Date
  changed: boolean
  preservesLongerWindow: boolean
}

export function resolveMemberProAccessWindowRepair(
  input: MemberProAccessWindowRepairInput
): MemberProAccessWindowRepairResult {
  const window = resolveMemberProAccessWindow({
    start: input.sourceStart,
    currentExpiresAt: input.currentAccessExpiresAt,
  })
  const changed =
    input.currentAccessStartsAt?.getTime() !== window.accessStartsAt.getTime() ||
    input.currentAccessExpiresAt?.getTime() !== window.accessExpiresAt.getTime()

  return {
    ...window,
    changed,
    preservesLongerWindow:
      input.currentAccessExpiresAt !== null &&
      input.currentAccessExpiresAt.getTime() >
        input.sourceStart.getTime() + MEMBER_PRO_ACCESS_DAYS * 24 * 60 * 60 * 1000,
  }
}
