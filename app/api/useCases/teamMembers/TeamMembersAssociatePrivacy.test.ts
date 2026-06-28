import { describe, expect, it } from "bun:test";

function filterSponsorFromMembers<T extends { profileId: string }>(
  members: T[],
  isAssociateAccount: boolean,
  sponsorMasterId: string | null
) {
  if (!isAssociateAccount || !sponsorMasterId) return members;
  return members.filter((member) => member.profileId !== sponsorMasterId);
}

describe("associate team member privacy filter", () => {
  const members = [
    { profileId: "sponsor-1", name: "Bruno" },
    { profileId: "closer-1", name: "Closer" },
  ];

  it("removes sponsor from associate account member list", () => {
    const visible = filterSponsorFromMembers(members, true, "sponsor-1");
    expect(visible).toHaveLength(1);
    expect(visible[0]?.profileId).toBe("closer-1");
  });

  it("keeps all members for non-associate accounts", () => {
    const visible = filterSponsorFromMembers(members, false, "sponsor-1");
    expect(visible).toHaveLength(2);
  });
});
