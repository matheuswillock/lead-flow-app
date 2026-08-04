import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess: mock(async () => ({})),
  teamContextFromRadarAccess: mock(() => ({ profileId: "profile-1", teamMember: { id: "tm-1" } })),
}))

mock.module("@/app/api/useCases/radar/MaterializeSegmentToContactListUseCase", () => ({
  materializeSegmentToContactListUseCase: {
    preview: mock(async () => ({})),
    execute: mock(async () => ({})),
  },
}))

mock.module("@/lib/radar/segment-audience", () => ({
  CUSTOM_RADAR_SEGMENT_PREFIX: "custom:",
}))

const { getRadarAccess } = await import("@/app/api/v1/radar/utils/getRadarAccess")
const { materializeSegmentToContactListUseCase } = await import(
  "@/app/api/useCases/radar/MaterializeSegmentToContactListUseCase"
)

const mockAccess = {
  error: null,
  status: 200,
  access: {
    teamId: "team-1",
    profileId: "profile-1",
    teamMember: { id: "tm-1", role: "manager" },
  },
}

const SEGMENT_ID = "seg-uuid-123"

function makeGetRequest(): [NextRequest, { params: Promise<{ segmentId: string }> }] {
  const req = new NextRequest(
    `http://localhost/api/v1/radar/segments/custom/${SEGMENT_ID}/materialize-contact-list`
  )
  return [req, { params: Promise.resolve({ segmentId: SEGMENT_ID }) }]
}

function makePostRequest(): [NextRequest, { params: Promise<{ segmentId: string }> }] {
  const req = new NextRequest(
    `http://localhost/api/v1/radar/segments/custom/${SEGMENT_ID}/materialize-contact-list`,
    { method: "POST" }
  )
  return [req, { params: Promise.resolve({ segmentId: SEGMENT_ID }) }]
}

describe("GET /api/v1/radar/segments/custom/[segmentId]/materialize-contact-list", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    ;(materializeSegmentToContactListUseCase.preview as ReturnType<typeof mock>).mockReset()
  })

  it("retorna 401 quando sem acesso", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: { isValid: false, successMessages: [], errorMessages: ["Não autorizado"], result: null },
      status: 401,
      access: null,
    })
    const [req, params] = makeGetRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(401)
  })

  it("retorna 200 com estimatedCount quando segmento tem perfis", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(materializeSegmentToContactListUseCase.preview as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { estimatedCount: 42 },
    })
    const [req, params] = makeGetRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { estimatedCount: number } }
    expect(body.result.estimatedCount).toBe(42)
  })

  it("passa o segmentSlug prefixado com 'custom:' para o use case", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(materializeSegmentToContactListUseCase.preview as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { estimatedCount: 0 },
    })
    const [req, params] = makeGetRequest()
    await GET(req, params)
    const calls = (materializeSegmentToContactListUseCase.preview as ReturnType<typeof mock>).mock.calls
    expect(calls.length).toBe(1)
    expect(calls[0]?.[1]).toBe(`custom:${SEGMENT_ID}`)
  })
})

describe("POST /api/v1/radar/segments/custom/[segmentId]/materialize-contact-list", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    ;(materializeSegmentToContactListUseCase.execute as ReturnType<typeof mock>).mockReset()
  })

  it("retorna 401 quando sem acesso", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: { isValid: false, successMessages: [], errorMessages: ["Não autorizado"], result: null },
      status: 401,
      access: null,
    })
    const [req, params] = makePostRequest()
    const res = await POST(req, params)
    expect(res.status).toBe(401)
  })

  it("retorna 201 com listId e contactCount ao materializar", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(materializeSegmentToContactListUseCase.execute as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: ["Lista criada com 5 contato(s)"],
      errorMessages: [],
      result: { listId: "list-uuid-1", contactCount: 5 },
    })
    const [req, params] = makePostRequest()
    const res = await POST(req, params)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { result: { listId: string; contactCount: number } }
    expect(body.result.listId).toBe("list-uuid-1")
    expect(body.result.contactCount).toBe(5)
  })

  it("idempotência: chamar 2x não duplica — use case é chamado e retorna mesmo count", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValue(mockAccess)
    ;(materializeSegmentToContactListUseCase.execute as ReturnType<typeof mock>).mockResolvedValue({
      isValid: true,
      successMessages: ["Lista criada com 3 contato(s)"],
      errorMessages: [],
      result: { listId: "list-uuid-2", contactCount: 3 },
    })

    const [req1, params1] = makePostRequest()
    const res1 = await POST(req1, params1)
    const [req2, params2] = makePostRequest()
    const res2 = await POST(req2, params2)

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)

    const body1 = (await res1.json()) as { result: { contactCount: number } }
    const body2 = (await res2.json()) as { result: { contactCount: number } }
    expect(body1.result.contactCount).toBe(3)
    expect(body2.result.contactCount).toBe(3)
  })

  it("retorna 400 quando segmento inválido", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(materializeSegmentToContactListUseCase.execute as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: false,
      successMessages: [],
      errorMessages: ["Segmento inválido"],
      result: null,
    })
    const [req, params] = makePostRequest()
    const res = await POST(req, params)
    expect(res.status).toBe(400)
  })
})
