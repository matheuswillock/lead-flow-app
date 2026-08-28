import { describe, expect, it } from "bun:test";
import {
  deleteSubscriptionStateSnapshotsForProfiles,
  uniqueProfileIds,
} from "./deleteSubscriptionStateSnapshots";

describe("deleteSubscriptionStateSnapshotsForProfiles", () => {
  it("deduplica ids e ignora vazios", () => {
    expect(uniqueProfileIds(["a", "", "a", "b"])).toEqual(["a", "b"]);
  });

  it("não chama o banco quando não há profileId", async () => {
    const calls: unknown[] = [];
    await deleteSubscriptionStateSnapshotsForProfiles(
      {
        subscriptionStateSnapshot: {
          deleteMany: async (args) => {
            calls.push(args);
            return { count: 0 };
          },
        },
      },
      ["", ""],
    );
    expect(calls).toEqual([]);
  });

  it("apaga snapshots dos profiles informados", async () => {
    const calls: unknown[] = [];
    await deleteSubscriptionStateSnapshotsForProfiles(
      {
        subscriptionStateSnapshot: {
          deleteMany: async (args) => {
            calls.push(args);
            return { count: 2 };
          },
        },
      },
      ["profile-1", "profile-1", "profile-2"],
    );
    expect(calls).toEqual([
      { where: { profileId: { in: ["profile-1", "profile-2"] } } },
    ]);
  });
});
