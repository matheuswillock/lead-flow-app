import { ActivityType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import type {
  ContactDTO,
  ContactsResult,
  ContactsStats,
  CreateContactInput,
  ILeadContactsUseCase,
} from "./ILeadContactsUseCase";

const CONTACT_TYPES: ActivityType[] = [
  ActivityType.call,
  ActivityType.whatsapp,
  ActivityType.email,
  ActivityType.meeting,
  ActivityType.visit,
  ActivityType.missed,
];

const POSITIVE_OUTCOMES = new Set([
  "answered",
  "replied",
  "opened",
  "attended",
]);

function computeEffectivenessRate(
  contacts: { outcome: string | null }[]
): number {
  if (contacts.length === 0) return 0;
  const positiveCount = contacts.filter(
    (c) => c.outcome && POSITIVE_OUTCOMES.has(c.outcome)
  ).length;
  return Math.round((positiveCount / contacts.length) * 100);
}

function resolveLastContactDate(
  contacts: { contactDate: Date | null; createdAt: Date }[]
): string | null {
  if (contacts.length === 0) return null;
  let latest: Date | null = null;
  for (const c of contacts) {
    const candidate = c.contactDate ?? c.createdAt;
    if (!latest || candidate > latest) {
      latest = candidate;
    }
  }
  return latest ? latest.toISOString() : null;
}

class LeadContactsUseCase implements ILeadContactsUseCase {
  async listContacts(leadId: string, teamId: string): Promise<Output> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamId) {
      return new Output(
        false,
        [],
        ["Lead não encontrado ou sem permissão no seu time."],
        null
      );
    }

    const rows = await (prisma.leadActivity as any).findMany({
      where: { leadId, type: { in: CONTACT_TYPES } },
      select: {
        id: true,
        type: true,
        body: true,
        outcome: true,
        duration: true,
        contactDate: true,
        contactTime: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const contacts: ContactDTO[] = rows.map(
      (row: {
        id: string;
        type: string;
        body: string | null;
        outcome: string | null;
        duration: number | null;
        contactDate: Date | null;
        contactTime: string | null;
        createdAt: Date;
        author: {
          id: string;
          fullName: string | null;
          email: string;
          profileIconUrl: string | null;
        } | null;
      }) => ({
        id: row.id,
        type: row.type,
        body: row.body ?? null,
        outcome: row.outcome ?? null,
        duration: row.duration ?? null,
        contactDate: row.contactDate?.toISOString() ?? null,
        contactTime: row.contactTime ?? null,
        createdAt: row.createdAt.toISOString(),
        author: row.author
          ? {
              id: row.author.id,
              fullName: row.author.fullName ?? null,
              email: row.author.email,
              avatarUrl: row.author.profileIconUrl ?? null,
            }
          : null,
      })
    );

    const stats: ContactsStats = {
      total: contacts.length,
      lastContactDate: resolveLastContactDate(
        rows.map((r: { contactDate: Date | null; createdAt: Date }) => ({
          contactDate: r.contactDate ?? null,
          createdAt: r.createdAt,
        }))
      ),
      effectivenessRate: computeEffectivenessRate(
        rows.map((r: { outcome: string | null }) => ({
          outcome: r.outcome ?? null,
        }))
      ),
    };

    const result: ContactsResult = { stats, contacts };
    return new Output(true, [], [], result);
  }

  async createContact(
    leadId: string,
    teamId: string,
    profileId: string,
    data: CreateContactInput
  ): Promise<Output> {
    if (!CONTACT_TYPES.includes(data.type)) {
      return new Output(
        false,
        [],
        [
          `Tipo inválido para contato: ${data.type}. Use: ${CONTACT_TYPES.join(", ")}`,
        ],
        null
      );
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamId) {
      return new Output(
        false,
        [],
        ["Lead não encontrado ou sem permissão no seu time."],
        null
      );
    }

    const activity = await (prisma.leadActivity as any).create({
      data: {
        leadId,
        type: data.type,
        body: data.body?.trim() ?? null,
        outcome: data.outcome ?? null,
        duration: data.duration ?? null,
        contactDate: data.contactDate ? new Date(data.contactDate) : null,
        contactTime: data.contactTime ?? null,
        createdBy: profileId,
      },
      select: {
        id: true,
        type: true,
        body: true,
        outcome: true,
        duration: true,
        contactDate: true,
        contactTime: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
      },
    });

    const contactDTO: ContactDTO = {
      id: activity.id,
      type: activity.type,
      body: activity.body ?? null,
      outcome: activity.outcome ?? null,
      duration: activity.duration ?? null,
      contactDate: activity.contactDate?.toISOString() ?? null,
      contactTime: activity.contactTime ?? null,
      createdAt: activity.createdAt.toISOString(),
      author: activity.author
        ? {
            id: activity.author.id,
            fullName: activity.author.fullName ?? null,
            email: activity.author.email,
            avatarUrl: activity.author.profileIconUrl ?? null,
          }
        : null,
    };

    return new Output(true, ["Contato registrado com sucesso"], [], contactDTO);
  }
}

export const leadContactsUseCase = new LeadContactsUseCase();
