import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest, NextResponse, after } from "next/server";
import { Output } from "@/lib/output";

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  after,
  connection: mock(async () => undefined),
}));
mock.module("server-only", () => ({}));

type Access = {
  teamId: string;
  profileId: string;
  managerId: string;
  isMaster: boolean;
  canCreateAccountUsers: boolean;
  teamMember: { role: string };
};

let access: Access;

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: mock(async () => ({ access })),
  hasDelegatedUserCreationAccess: (a: Access) => a.isMaster || a.canCreateAccountUsers,
}));

const sendAccessEmail = mock(async () => ({ output: new Output(true, ["ok"], [], null), status: 200 }));
mock.module("@/app/api/useCases/teamMemberAccessEmail/teamMemberAccessEmailComposition", () => ({
  teamMemberAccessEmailUseCase: { sendAccessEmail },
}));

const { POST } = await import("./route");

const params = Promise.resolve({ supabaseId: "user-1", userId: "target-1" });

function request() {
  return new NextRequest("http://localhost/api/v1/manager/user-1/users/target-1/access-email", {
    method: "POST",
    headers: { "x-supabase-user-id": "user-1" },
  });
}

function setAccess(overrides: Partial<Access>) {
  access = {
    teamId: "team-1",
    profileId: "profile-1",
    managerId: "master-1",
    isMaster: false,
    canCreateAccountUsers: false,
    teamMember: { role: "manager" },
    ...overrides,
  };
}

beforeEach(() => {
  sendAccessEmail.mockClear();
  setAccess({});
});

describe("POST access-email — reenviar acesso respeita a delegação", () => {
  it("manager sem delegação não reenvia o e-mail de acesso", async () => {
    const response = await POST(request(), { params });

    expect(response.status).toBe(403);
    expect(sendAccessEmail).not.toHaveBeenCalled();
  });

  it("manager com delegação reenvia", async () => {
    setAccess({ canCreateAccountUsers: true });

    const response = await POST(request(), { params });

    expect(response.status).toBe(200);
    expect(sendAccessEmail).toHaveBeenCalledTimes(1);
  });

  it("master sempre reenvia", async () => {
    setAccess({ isMaster: true });

    const response = await POST(request(), { params });

    expect(response.status).toBe(200);
    expect(sendAccessEmail).toHaveBeenCalledTimes(1);
  });
});
