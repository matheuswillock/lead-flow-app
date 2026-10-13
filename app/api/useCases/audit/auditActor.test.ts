import { describe, expect, it } from "bun:test"
import { buildAuditActorMetadata } from "./auditActor"

describe("buildAuditActorMetadata", () => {
  it("identifica o operador backoffice que originou a ação", () => {
    expect(
      buildAuditActorMetadata(
        {
          profileId: "profile-1",
          backofficeUserId: "backoffice-1",
          backofficeEmail: "operador@corretorstudio.com.br",
        },
        { operation: "account_user_created" },
      ),
    ).toEqual({
      operation: "account_user_created",
      actorKind: "backoffice_user",
      backofficeUserId: "backoffice-1",
      backofficeEmail: "operador@corretorstudio.com.br",
    })
  })

  it("mantém a origem de uma ação feita pelo próprio perfil", () => {
    expect(buildAuditActorMetadata({ profileId: "profile-1" })).toEqual({
      actorKind: "profile",
      backofficeUserId: null,
      backofficeEmail: null,
    })
  })
})
