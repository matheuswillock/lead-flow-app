import type {
  BackofficeDeletionApprovalDecision,
  BackofficeDeletionRequestStatus,
  BackofficeDeletionRequestType,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeDeletionRequestListItem,
  IBackofficeDeletionRequestRepository,
} from "./IBackofficeDeletionRequestRepository"

const requestSelect = {
  id: true,
  type: true,
  targetId: true,
  requestedByProfileId: true,
  status: true,
  reason: true,
  snapshot: true,
  createdAt: true,
  executedAt: true,
  requestedBy: {
    select: { email: true, fullName: true },
  },
  approvals: {
    select: {
      id: true,
      approverProfileId: true,
      decision: true,
      createdAt: true,
      approver: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const

function mapRequest(row: {
  id: string
  type: BackofficeDeletionRequestType
  targetId: string
  requestedByProfileId: string
  status: BackofficeDeletionRequestStatus
  reason: string | null
  snapshot: unknown
  createdAt: Date
  executedAt: Date | null
  requestedBy: { email: string; fullName: string | null }
  approvals: Array<{
    id: string
    approverProfileId: string
    decision: BackofficeDeletionApprovalDecision
    createdAt: Date
    approver: { email: string }
  }>
}): BackofficeDeletionRequestListItem {
  return {
    id: row.id,
    type: row.type,
    targetId: row.targetId,
    requestedByProfileId: row.requestedByProfileId,
    requestedByEmail: row.requestedBy.email,
    requestedByName: row.requestedBy.fullName,
    status: row.status,
    reason: row.reason,
    snapshot: row.snapshot,
    createdAt: row.createdAt,
    executedAt: row.executedAt,
    approvals: row.approvals.map((a) => ({
      id: a.id,
      approverProfileId: a.approverProfileId,
      approverEmail: a.approver.email,
      decision: a.decision,
      createdAt: a.createdAt,
    })),
  }
}

export class BackofficeDeletionRequestRepository implements IBackofficeDeletionRequestRepository {
  async create(input: {
    type: BackofficeDeletionRequestType
    targetId: string
    requestedByProfileId: string
    reason?: string | null
    snapshot?: unknown
  }): Promise<{ id: string }> {
    const created = await prisma.backofficeDeletionRequest.create({
      data: {
        type: input.type,
        targetId: input.targetId,
        requestedByProfileId: input.requestedByProfileId,
        reason: input.reason ?? null,
        snapshot: input.snapshot ?? undefined,
      },
      select: { id: true },
    })
    return created
  }

  async findById(id: string): Promise<BackofficeDeletionRequestListItem | null> {
    const row = await prisma.backofficeDeletionRequest.findUnique({
      where: { id },
      select: requestSelect,
    })
    return row ? mapRequest(row) : null
  }

  async list(input?: {
    status?: BackofficeDeletionRequestStatus
  }): Promise<BackofficeDeletionRequestListItem[]> {
    const rows = await prisma.backofficeDeletionRequest.findMany({
      where: input?.status ? { status: input.status } : undefined,
      select: requestSelect,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    })
    return rows.map(mapRequest)
  }

  async findPendingForTarget(
    type: BackofficeDeletionRequestType,
    targetId: string
  ): Promise<{ id: string } | null> {
    return prisma.backofficeDeletionRequest.findFirst({
      where: { type, targetId, status: "pending" },
      select: { id: true },
    })
  }

  async createApproval(input: {
    requestId: string
    approverProfileId: string
    decision: BackofficeDeletionApprovalDecision
  }): Promise<void> {
    await prisma.backofficeDeletionApproval.create({
      data: {
        requestId: input.requestId,
        approverProfileId: input.approverProfileId,
        decision: input.decision,
      },
    })
  }

  async updateStatus(
    id: string,
    status: BackofficeDeletionRequestStatus,
    executedAt?: Date | null
  ): Promise<void> {
    await prisma.backofficeDeletionRequest.update({
      where: { id },
      data: {
        status,
        ...(executedAt !== undefined ? { executedAt } : {}),
      },
    })
  }

  async findProfileSnapshot(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isMaster: true,
        deletedAt: true,
      },
    })
  }

  async findTeamSnapshot(teamId: string) {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, masterId: true, deletedAt: true },
    })
  }

  async findApproverProfileIdsByEmails(emails: string[]) {
    const normalized = emails.map((e) => e.trim().toLowerCase())
    const rows = await prisma.profile.findMany({
      where: { email: { in: normalized, mode: "insensitive" }, deletedAt: null },
      select: { id: true, email: true },
    })
    return rows
  }
}
