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
  return context.isActive;
}

export function buildMemberProContextFromAssignment(
  assignment: { slug: string; accessExpiresAt: Date | null } | null
): MemberProBillingContext {
  const slug = assignment?.slug ?? "common";
  const accessExpiresAt = assignment?.accessExpiresAt ?? null;
  const isActive =
    slug === MEMBER_PRO_SLUG &&
    (accessExpiresAt === null || accessExpiresAt.getTime() > Date.now());

  return { slug, isActive, accessExpiresAt };
}
