import type {
  MemberProBillingContext,
  MemberProBypassOptions,
} from "@/app/api/shared/billing/memberProBillingTypes";

const MEMBER_PRO_SLUG = "member_pro";

export function resolveMemberProBypass(
  context: MemberProBillingContext,
  options?: MemberProBypassOptions
): boolean {
  if (options?.forceCharge === true) {
    return false;
  }
  return context.isActive || context.hasUnlimitedUsers === true;
}

export function isActiveMemberProAssignment(
  assignment: { slug: string; accessExpiresAt: Date | null } | null,
  now: Date = new Date()
): boolean {
  if (!assignment || assignment.slug !== MEMBER_PRO_SLUG) {
    return false;
  }
  return assignment.accessExpiresAt === null || assignment.accessExpiresAt.getTime() > now.getTime();
}

export function buildMemberProContextFromAssignment(
  assignment: { slug: string; accessExpiresAt: Date | null } | null
): MemberProBillingContext {
  const slug = assignment?.slug ?? "common";
  const accessExpiresAt = assignment?.accessExpiresAt ?? null;
  const isActive = isActiveMemberProAssignment(assignment);

  return { slug, isActive, accessExpiresAt };
}

/** Fonte de verdade: flag persistida ou assinatura vitalícia. Sem fallback annual/YEARLY/Member PRO. */
export function resolveHasUnlimitedUsers(input: {
  hasUnlimitedUsersFlag?: boolean;
  hasPermanentSubscription?: boolean;
}): boolean {
  return input.hasUnlimitedUsersFlag === true || input.hasPermanentSubscription === true;
}
