import type { ActivityType, LeadProposalReviewStatus, LeadRequiredDocumentStatus, LeadRequiredDocumentType, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export const REQUIRED_ASSOCIATE_DOC_TYPES: LeadRequiredDocumentType[] = [
  "rg",
  "address_proof",
  "social_contract",
];

export const STUDIO_FEED_IDENTITY = {
  displayAuthor: "Corretor Studio",
  authorAvatarUrl: "/corretor-studio-icon.svg",
} as const;

export type AssociateProposalListQuery = {
  sponsorProfileId: string;
  associateAccountId?: string;
  teamId?: string;
  closerId?: string;
  from?: Date;
  to?: Date;
  search?: string;
  page: number;
  pageSize: number;
};

export type AssociateProposalListRow = {
  leadId: string;
  leadCode: string;
  leadName: string;
  leadPhone: string | null;
  associateAccountId: string;
  associateAccountName: string;
  teamId: string;
  teamName: string;
  closerId: string | null;
  closerName: string | null;
  soldPlan: string | null;
  ticket: number | null;
  statusEnteredAt: Date;
  reviewStatus: LeadProposalReviewStatus;
  criticizedTitle: string | null;
  requiredDocumentsSummary: {
    pending: number;
    uploaded: number;
    approved: number;
  };
};

function buildLeadWhere(query: AssociateProposalListQuery): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [
    { status: "offerSubmission" as LeadStatus },
    {
      team: {
        is: {
          master: {
            is: {
              sponsorMasterId: query.sponsorProfileId,
            },
          },
        },
      },
    },
  ];

  if (query.associateAccountId) {
    and.push({ team: { is: { masterId: query.associateAccountId } } });
  }
  if (query.teamId) {
    and.push({ teamId: query.teamId });
  }
  if (query.closerId) {
    and.push({ closerId: query.closerId });
  }
  if (query.from || query.to) {
    and.push({
      statusEnteredAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      },
    });
  }
  if (query.search?.trim()) {
    const term = query.search.trim();
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
        { leadCode: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  return { AND: and };
}

function summarizeDocs(
  docs: Array<{ status: LeadRequiredDocumentStatus }>
): AssociateProposalListRow["requiredDocumentsSummary"] {
  return {
    pending: docs.filter((d) => d.status === "pending" || d.status === "rejected").length,
    uploaded: docs.filter((d) => d.status === "uploaded").length,
    approved: docs.filter((d) => d.status === "approved").length,
  };
}

export class AssociateProposalRepository {
  async listProposals(query: AssociateProposalListQuery) {
    const where = buildLeadWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { statusEnteredAt: "desc" },
        select: {
          id: true,
          leadCode: true,
          name: true,
          phone: true,
          soldPlan: true,
          ticket: true,
          statusEnteredAt: true,
          closerId: true,
          closer: { select: { fullName: true, email: true } },
          teamId: true,
          team: {
            select: {
              id: true,
              name: true,
              masterId: true,
              master: { select: { fullName: true, email: true } },
            },
          },
          proposalReview: {
            select: {
              status: true,
              criticizedTitle: true,
            },
          },
          requiredDocuments: {
            select: { status: true },
          },
        },
      }),
    ]);

    const items: AssociateProposalListRow[] = leads.map((lead) => ({
      leadId: lead.id,
      leadCode: lead.leadCode,
      leadName: lead.name,
      leadPhone: lead.phone,
      associateAccountId: lead.team!.masterId,
      associateAccountName: lead.team!.master.fullName ?? lead.team!.master.email,
      teamId: lead.team!.id,
      teamName: lead.team!.name,
      closerId: lead.closerId,
      closerName: lead.closer?.fullName ?? lead.closer?.email ?? null,
      soldPlan: lead.soldPlan,
      ticket: lead.ticket ? Number(lead.ticket) : null,
      statusEnteredAt: lead.statusEnteredAt,
      reviewStatus: lead.proposalReview?.status ?? "submitted",
      criticizedTitle: lead.proposalReview?.criticizedTitle ?? null,
      requiredDocumentsSummary: summarizeDocs(lead.requiredDocuments),
    }));

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findProposalDetail(leadId: string, sponsorProfileId: string) {
    return prisma.lead.findFirst({
      where: {
        id: leadId,
        status: "offerSubmission",
        team: { master: { sponsorMasterId: sponsorProfileId } },
      },
      select: {
        id: true,
        leadCode: true,
        name: true,
        phone: true,
        email: true,
        soldPlan: true,
        ticket: true,
        status: true,
        statusEnteredAt: true,
        closerId: true,
        closer: { select: { id: true, fullName: true, email: true } },
        team: {
          select: {
            id: true,
            name: true,
            master: { select: { id: true, fullName: true, email: true } },
          },
        },
        proposalReview: true,
        requiredDocuments: {
          select: {
            id: true,
            documentType: true,
            status: true,
            attachmentId: true,
            attachment: {
              select: { id: true, fileName: true, fileUrl: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            type: true,
            body: true,
            payload: true,
            createdAt: true,
            createdBy: true,
          },
        },
      },
    });
  }

  async assertLeadBelongsToSponsor(leadId: string, sponsorProfileId: string) {
    return prisma.lead.findFirst({
      where: {
        id: leadId,
        team: { master: { sponsorMasterId: sponsorProfileId } },
      },
      select: {
        id: true,
        leadCode: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        teamId: true,
        closerId: true,
        team: {
          select: {
            masterId: true,
            master: { select: { sponsorMasterId: true, fullName: true, email: true } },
          },
        },
        proposalReview: true,
      },
    });
  }

  async findProfileSponsorMasterId(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { sponsorMasterId: true },
    });
  }

  async countSponsoredAccounts(profileId: string) {
    return prisma.profile.count({ where: { sponsorMasterId: profileId } });
  }

  async findTeamSponsorMasterId(teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { master: { select: { sponsorMasterId: true } } },
    });
    return team?.master?.sponsorMasterId ?? null;
  }

  async ensureProposalArtifacts(leadId: string) {
    await prisma.leadProposalReview.upsert({
      where: { leadId },
      create: { leadId, status: "submitted" },
      update: {},
    });

    await Promise.all(
      REQUIRED_ASSOCIATE_DOC_TYPES.map((documentType) =>
        prisma.leadRequiredDocument.upsert({
          where: { leadId_documentType: { leadId, documentType } },
          create: { leadId, documentType, status: "pending" },
          update: {},
        })
      )
    );
  }

  async findAssociateOfferNotificationRecipients(teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        masterId: true,
        master: { select: { sponsorMasterId: true } },
      },
    });

    const sponsorMasterId = team?.master?.sponsorMasterId;
    if (!sponsorMasterId || !team?.masterId) {
      return null;
    }

    const [sponsorProfile, sponsorBackoffices, associateMaster] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: sponsorMasterId },
        select: { id: true },
      }),
      prisma.teamMember.findMany({
        where: {
          role: "backoffice",
          team: { masterId: sponsorMasterId },
        },
        select: { profileId: true },
      }),
      prisma.profile.findUnique({
        where: { id: team.masterId },
        select: { id: true },
      }),
    ]);

    const recipientIds = Array.from(
      new Set(
        [
          sponsorProfile?.id,
          associateMaster?.id,
          ...sponsorBackoffices.map((member) => member.profileId),
        ].filter((id): id is string => Boolean(id))
      )
    );

    return { sponsorMasterId, recipientIds };
  }

  async resetCriticizedReview(leadId: string) {
    const review = await prisma.leadProposalReview.findUnique({ where: { leadId } });
    if (review?.status !== "criticized") return;
    await prisma.leadProposalReview.update({
      where: { leadId },
      data: {
        status: "submitted",
        criticizedTitle: null,
        criticizedMessage: null,
        criticizedAt: null,
      },
    });
  }

  async findRequiredDocumentStatuses(leadId: string) {
    return prisma.leadRequiredDocument.findMany({
      where: { leadId },
      select: { documentType: true, status: true },
    });
  }

  async criticizeProposal(input: {
    leadId: string;
    title: string;
    message: string;
    reviewedByProfileId: string;
    assigneeId: string | null;
    createdByProfileId: string;
  }) {
    let createdTaskId: string | null = null;

    await prisma.$transaction(async (tx) => {
      await tx.leadProposalReview.upsert({
        where: { leadId: input.leadId },
        create: {
          leadId: input.leadId,
          status: "criticized",
          criticizedTitle: input.title,
          criticizedMessage: input.message,
          criticizedAt: new Date(),
          reviewedByProfileId: input.reviewedByProfileId,
        },
        update: {
          status: "criticized",
          criticizedTitle: input.title,
          criticizedMessage: input.message,
          criticizedAt: new Date(),
          reviewedByProfileId: input.reviewedByProfileId,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          type: "note" as ActivityType,
          body: input.message,
          createdBy: null,
          payload: {
            kind: "proposal_criticism",
            ...STUDIO_FEED_IDENTITY,
            title: input.title,
            message: input.message,
          },
        },
      });

      if (!input.assigneeId) return;

      const activity = await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          type: "task" as ActivityType,
          body: input.message,
          createdBy: null,
          payload: {
            kind: "task",
            title: input.title,
            taskType: "proposal",
            isUrgent: true,
            assigneeProfileIds: [input.assigneeId],
          },
        },
      });

      const task = await tx.task.create({
        data: {
          leadId: input.leadId,
          activityId: activity.id,
          title: input.title,
          taskType: "proposal",
          body: input.message,
          isUrgent: true,
          createdBy: input.createdByProfileId,
          assignees: { create: [{ profileId: input.assigneeId }] },
        },
      });
      createdTaskId = task.id;
    });

    return createdTaskId;
  }

  async registerSale(input: {
    leadId: string;
    reviewedByProfileId: string;
    operatorName: string;
    salePayload: Prisma.InputJsonValue;
  }) {
    await prisma.$transaction(async (tx) => {
      await tx.leadProposalReview.upsert({
        where: { leadId: input.leadId },
        create: {
          leadId: input.leadId,
          status: "approved",
          saleRegisteredAt: new Date(),
          salePayload: input.salePayload,
          reviewedByProfileId: input.reviewedByProfileId,
        },
        update: {
          status: "approved",
          saleRegisteredAt: new Date(),
          salePayload: input.salePayload,
          reviewedByProfileId: input.reviewedByProfileId,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          type: "note" as ActivityType,
          body: `Venda registrada na operadora ${input.operatorName}`,
          createdBy: null,
          payload: {
            kind: "sale_registered",
            ...STUDIO_FEED_IDENTITY,
            message: `Operadora: ${input.operatorName}`,
            metadata: input.salePayload,
          },
        },
      });

      await tx.lead.update({
        where: { id: input.leadId },
        data: { status: "dps_agreement" as LeadStatus, statusEnteredAt: new Date() },
      });
    });
  }

  async approveRequiredDocument(input: {
    leadId: string;
    documentType: LeadRequiredDocumentType;
    reviewedByProfileId: string;
  }) {
    await prisma.leadRequiredDocument.update({
      where: { leadId_documentType: { leadId: input.leadId, documentType: input.documentType } },
      data: {
        status: "approved",
        reviewedByProfileId: input.reviewedByProfileId,
      },
    });

    const docs = await prisma.leadRequiredDocument.findMany({
      where: { leadId: input.leadId },
      select: { status: true },
    });

    if (docs.every((doc) => doc.status === "approved")) {
      await prisma.leadActivity.create({
        data: {
          leadId: input.leadId,
          type: "note" as ActivityType,
          body: "Documentos obrigatórios aprovados",
          createdBy: null,
          payload: { kind: "docs_complete", ...STUDIO_FEED_IDENTITY },
        },
      });
    }
  }

  async uploadPaymentProof(leadId: string, attachmentId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.leadActivity.create({
        data: {
          leadId,
          type: "note" as ActivityType,
          body: "Comprovante de pagamento recebido",
          createdBy: null,
          payload: {
            kind: "payment_proof_uploaded",
            ...STUDIO_FEED_IDENTITY,
            metadata: { attachmentId },
          },
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { status: "dps_agreement" as LeadStatus, statusEnteredAt: new Date() },
      });
    });
  }
}

export const associateProposalRepository = new AssociateProposalRepository();
