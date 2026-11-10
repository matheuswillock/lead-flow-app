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

const realRoles = await import("@/lib/roles");

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: mock(async () => ({ access })),
  hasDelegatedUserCreationAccess: (a: Access) => a.isMaster || a.canCreateAccountUsers,
}));

const updateAccountUser = mock(async () => ({ output: new Output(true, ["ok"], [], null), status: 200 }));
const removeAccountUser = mock(async () => ({ output: new Output(true, ["ok"], [], null), status: 200 }));

mock.module("@/app/api/useCases/managerAccountUsers/ManagerAccountUsersUseCase", () => ({
  managerAccountUsersUseCase: { updateAccountUser, removeAccountUser },
}));

const { PUT, DELETE } = await import("./route");

const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ supabaseId: "user-1" });

function request(method: "PUT" | "DELETE", body: unknown) {
  return new NextRequest("http://localhost/api/v1/manager/user-1/users", {
    method,
    headers: { "x-supabase-user-id": "user-1", "content-type": "application/json" },
    body: JSON.stringify(body),
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
  updateAccountUser.mockClear();
  removeAccountUser.mockClear();
  setAccess({});
  expect(realRoles.isManagerLikeRole("manager")).toBe(true);
});

describe("PUT /manager/[supabaseId]/users — editar usuário respeita a delegação", () => {
  it("manager sem delegação não edita usuários", async () => {
    const response = await PUT(request("PUT", { id: TARGET_ID, name: "Novo Nome" }), { params });

    expect(response.status).toBe(403);
    expect(updateAccountUser).not.toHaveBeenCalled();
  });

  it("manager com delegação edita usuários", async () => {
    setAccess({ canCreateAccountUsers: true });

    const response = await PUT(request("PUT", { id: TARGET_ID, name: "Novo Nome" }), { params });

    expect(response.status).toBe(200);
    expect(updateAccountUser).toHaveBeenCalledTimes(1);
  });

  it("master sempre edita", async () => {
    setAccess({ isMaster: true });

    const response = await PUT(request("PUT", { id: TARGET_ID, name: "Novo Nome" }), { params });

    expect(response.status).toBe(200);
    expect(updateAccountUser).toHaveBeenCalledTimes(1);
  });

  it("operador nunca edita, mesmo com a flag de delegação", async () => {
    setAccess({ teamMember: { role: "operator" }, canCreateAccountUsers: true });

    const response = await PUT(request("PUT", { id: TARGET_ID, name: "Novo Nome" }), { params });

    expect(response.status).toBe(403);
    expect(updateAccountUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /manager/[supabaseId]/users — remover usuário respeita a delegação", () => {
  it("manager sem delegação não remove usuários", async () => {
    const response = await DELETE(request("DELETE", { userId: TARGET_ID }), { params });

    expect(response.status).toBe(403);
    expect(removeAccountUser).not.toHaveBeenCalled();
  });

  it("manager com delegação remove usuários", async () => {
    setAccess({ canCreateAccountUsers: true });

    const response = await DELETE(request("DELETE", { userId: TARGET_ID }), { params });

    expect(response.status).toBe(200);
    expect(removeAccountUser).toHaveBeenCalledTimes(1);
  });

  it("master sempre remove", async () => {
    setAccess({ isMaster: true });

    const response = await DELETE(request("DELETE", { userId: TARGET_ID }), { params });

    expect(response.status).toBe(200);
    expect(removeAccountUser).toHaveBeenCalledTimes(1);
  });
});
