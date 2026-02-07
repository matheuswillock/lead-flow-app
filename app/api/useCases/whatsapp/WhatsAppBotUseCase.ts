import { Output } from "@/lib/output";
import { normalizePhone, normalizePhoneForSearch } from "@/lib/phone";
import { decryptToken } from "@/lib/integrations-crypto";
import { whatsAppIntegrationRepository } from "@/app/api/infra/data/repositories/integrations/WhatsAppIntegrationRepository";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { whatsAppCloudService } from "@/app/api/services/whatsapp/WhatsAppCloudService";
import { buildHelpMessage, parseCommand } from "@/app/api/services/whatsapp/CommandParser";
import { ActivityType, LeadSource, LeadStatus } from "@prisma/client";

interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  text: string;
  phoneNumberId: string;
  timestamp?: string;
}

export class WhatsAppBotUseCase {
  async processWebhook(payload: any): Promise<Output> {
    const messages = this.extractMessages(payload);

    if (messages.length === 0) {
      return new Output(true, ["Nenhuma mensagem para processar"], [], null);
    }

    const results: any[] = [];
    const errors: string[] = [];

    for (const message of messages) {
      try {
        const result = await this.handleMessage(message);
        results.push(result);
      } catch (error: any) {
        errors.push(error?.message || "Erro ao processar mensagem");
      }
    }

    return new Output(true, ["Mensagens processadas"], errors, results);
  }

  private async handleMessage(message: WhatsAppIncomingMessage) {
    const integration = await whatsAppIntegrationRepository.findByPhoneNumberId(message.phoneNumberId);
    if (!integration || !integration.isActive) {
      return { skipped: true, reason: "Integração não encontrada ou inativa" };
    }

    const accessToken = decryptToken(integration.accessTokenEnc);
    const normalizedFrom = normalizePhone(message.from) || message.from;
    const teamId = await this.resolveTeamId(integration.managerId, integration.teamId);

    if (!teamId) {
      return { skipped: true, reason: "Team não encontrado" };
    }

    const actor = await this.findActorByPhone(teamId, normalizedFrom);
    if (!actor) {
      await this.safeSendText({
        phoneNumberId: integration.phoneNumberId,
        accessToken,
        to: message.from,
        message: "Número não autorizado. Fale com o gestor para liberar acesso."
      });
      return { skipped: true, reason: "Número não autorizado" };
    }

    const parsed = parseCommand(message.text);
    if (!parsed.ok) {
      await this.safeSendText({
        phoneNumberId: integration.phoneNumberId,
        accessToken,
        to: message.from,
        message: `${parsed.error}\n${buildHelpMessage()}`
      });
      return { skipped: true, reason: parsed.error };
    }

    switch (parsed.command.type) {
      case "help":
        await this.safeSendText({
          phoneNumberId: integration.phoneNumberId,
          accessToken,
          to: message.from,
          message: buildHelpMessage()
        });
        return { ok: true, command: "help" };

      case "lead":
        return this.handleLeadQuery({
          teamId,
          query: parsed.command.query,
          accessToken,
          phoneNumberId: integration.phoneNumberId,
          to: message.from
        });

      case "status":
        return this.handleStatusUpdate({
          teamId,
          identifier: parsed.command.identifier,
          status: parsed.command.status,
          actorId: actor.id,
          actorName: actor.fullName || actor.email,
          from: normalizedFrom,
          messageId: message.id,
          accessToken,
          phoneNumberId: integration.phoneNumberId,
          to: message.from
        });

      case "new":
        return this.handleNewLead({
          teamId,
          managerId: integration.managerId,
          actor,
          payload: parsed.command,
          from: normalizedFrom,
          messageId: message.id,
          accessToken,
          phoneNumberId: integration.phoneNumberId,
          to: message.from
        });

      case "note":
        return this.handleNote({
          teamId,
          identifier: parsed.command.identifier,
          note: parsed.command.note,
          actorId: actor.id,
          actorName: actor.fullName || actor.email,
          from: normalizedFrom,
          messageId: message.id,
          accessToken,
          phoneNumberId: integration.phoneNumberId,
          to: message.from
        });

      default:
        return { skipped: true, reason: "Comando não suportado" };
    }
  }

  private extractMessages(payload: any): WhatsAppIncomingMessage[] {
    const messages: WhatsAppIncomingMessage[] = [];
    const entries = payload?.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const incoming = value?.messages || [];

        for (const msg of incoming) {
          if (msg.type !== "text") continue;
          const body = msg.text?.body?.trim();
          if (!body || !phoneNumberId) continue;

          messages.push({
            from: msg.from,
            id: msg.id,
            text: body,
            phoneNumberId,
            timestamp: msg.timestamp
          });
        }
      }
    }

    return messages;
  }

  private async resolveTeamId(managerId: string, teamId?: string | null): Promise<string | null> {
    if (teamId) return teamId;
    const team = await prisma.team.findFirst({
      where: { masterId: managerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true }
    });
    return team?.id ?? null;
  }

  private async findActorByPhone(teamId: string, from: string) {
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        profile: {
          select: { id: true, fullName: true, email: true, role: true, managerId: true, isMaster: true, phone: true }
        }
      }
    });

    return members
      .map((member) => member.profile)
      .find((profile) => normalizePhone(profile.phone) === from);
  }

  private async handleLeadQuery(params: {
    teamId: string;
    query: string;
    accessToken: string;
    phoneNumberId: string;
    to: string;
  }) {
    const leads = await this.findLeadsByQuery(params.teamId, params.query);

    if (leads.length === 0) {
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: "Nenhum lead encontrado."
      });
      return { ok: false, reason: "not_found" };
    }

    if (leads.length > 1) {
      const list = leads.slice(0, 5).map((lead) => `• ${lead.leadCode} - ${lead.name} (${lead.status})`).join("\n");
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: `Encontrei ${leads.length} leads:\n${list}`
      });
      return { ok: true, count: leads.length };
    }

    const lead = leads[0];
    await this.safeSendText({
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      to: params.to,
      message: [
        `Lead ${lead.leadCode}`,
        `Nome: ${lead.name}`,
        `Status: ${lead.status}`,
        `Telefone: ${lead.phone || "-"}`,
        `Email: ${lead.email || "-"}`,
      ].join("\n")
    });

    return { ok: true, leadId: lead.id };
  }

  private async handleStatusUpdate(params: {
    teamId: string;
    identifier: string;
    status: LeadStatus;
    actorId: string;
    actorName: string;
    from: string;
    messageId: string;
    accessToken: string;
    phoneNumberId: string;
    to: string;
  }) {
    const leads = await this.findLeadsByQuery(params.teamId, params.identifier);

    if (leads.length === 0) {
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: "Lead não encontrado para atualizar status."
      });
      return { ok: false, reason: "not_found" };
    }

    if (leads.length > 1) {
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: "Mais de um lead encontrado. Especifique um leadCode exato."
      });
      return { ok: false, reason: "multiple" };
    }

    const lead = leads[0];
    const previousStatus = lead.status;

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: params.status,
        updatedBy: params.actorId
      }
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.status_change,
        body: `Status atualizado via WhatsApp por ${params.actorName}`,
        payload: {
          source: "whatsapp",
          from: params.from,
          messageId: params.messageId,
          previousStatus,
          nextStatus: params.status
        },
        createdBy: params.actorId
      }
    });

    await this.safeSendText({
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      to: params.to,
      message: `Status do lead ${lead.leadCode} atualizado para ${params.status}.`
    });

    return { ok: true, leadId: lead.id };
  }

  private async handleNewLead(params: {
    teamId: string;
    managerId: string;
    actor: { id: string; role: string; managerId: string | null; isMaster: boolean; fullName: string | null; email: string };
    payload: { name: string; phone: string; email?: string; city?: string; plan?: string };
    from: string;
    messageId: string;
    accessToken: string;
    phoneNumberId: string;
    to: string;
  }) {
    const phoneNormalized = normalizePhone(params.payload.phone);
    if (!phoneNormalized) {
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: "Telefone inválido."
      });
      return { ok: false, reason: "invalid_phone" };
    }

    const duplicate = await prisma.lead.findFirst({
      where: {
        teamId: params.teamId,
        OR: [
          { phoneNormalized },
          ...(params.payload.email ? [{ email: params.payload.email }] : [])
        ]
      }
    });

    if (duplicate) {
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: "Já existe um lead com esse telefone ou email."
      });
      return { ok: false, reason: "duplicate" };
    }

    const managerId = params.actor.isMaster ? params.actor.id : (params.actor.managerId || params.managerId);
    const leadCode = await this.generateLeadCode(params.payload.name);

    const notesParts = [] as string[];
    if (params.payload.city) notesParts.push(`Cidade: ${params.payload.city}`);
    if (params.payload.plan) notesParts.push(`Plano: ${params.payload.plan}`);

    const lead = await leadRepository.create({
      manager: { connect: { id: managerId } },
      team: { connect: { id: params.teamId } },
      leadCode,
      name: params.payload.name,
      email: params.payload.email || null,
      phone: params.payload.phone || null,
      phoneNormalized,
      status: LeadStatus.new_opportunity,
      source: LeadSource.whatsapp,
      whatsappFrom: params.from,
      whatsappMessageId: params.messageId,
      notes: notesParts.length > 0 ? notesParts.join("\n") : "Lead criado via WhatsApp",
      creator: { connect: { id: params.actor.id } },
      updater: { connect: { id: params.actor.id } },
      ...(params.actor.role === "operator" && {
        assignee: { connect: { id: params.actor.id } }
      }),
      activities: {
        create: {
          type: ActivityType.whatsapp,
          body: "Lead criado via WhatsApp",
          payload: {
            source: "whatsapp",
            from: params.from,
            messageId: params.messageId
          },
          author: { connect: { id: params.actor.id } }
        }
      }
    });

    await this.safeSendText({
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      to: params.to,
      message: `Lead criado com sucesso. Código: ${lead.leadCode}`
    });

    return { ok: true, leadId: lead.id };
  }

  private async handleNote(params: {
    teamId: string;
    identifier: string;
    note: string;
    actorId: string;
    actorName: string;
    from: string;
    messageId: string;
    accessToken: string;
    phoneNumberId: string;
    to: string;
  }) {
    const leads = await this.findLeadsByQuery(params.teamId, params.identifier);

    if (leads.length === 0) {
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: "Lead não encontrado para adicionar nota."
      });
      return { ok: false, reason: "not_found" };
    }

    if (leads.length > 1) {
      await this.safeSendText({
        phoneNumberId: params.phoneNumberId,
        accessToken: params.accessToken,
        to: params.to,
        message: "Mais de um lead encontrado. Especifique um leadCode exato."
      });
      return { ok: false, reason: "multiple" };
    }

    const lead = leads[0];

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.note,
        body: params.note,
        payload: {
          source: "whatsapp",
          from: params.from,
          messageId: params.messageId
        },
        createdBy: params.actorId
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { updatedBy: params.actorId }
    });

    await this.safeSendText({
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      to: params.to,
      message: `Nota adicionada ao lead ${lead.leadCode}.`
    });

    return { ok: true, leadId: lead.id };
  }

  private async findLeadsByQuery(teamId: string, query: string) {
    const trimmed = query.trim();
    const conditions: any[] = [];

    if (trimmed.includes("@")) {
      conditions.push({ email: { equals: trimmed, mode: "insensitive" } });
    }

    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    if (uuidRegex.test(trimmed)) {
      conditions.push({ id: trimmed });
    }

    const leadCodeRegex = /^[A-Za-z][0-9]{4,6}[A-Za-z]$/;
    if (leadCodeRegex.test(trimmed)) {
      conditions.push({ leadCode: { equals: trimmed, mode: "insensitive" } });
    }

    const normalized = normalizePhone(trimmed);
    if (normalized) {
      conditions.push({ phoneNormalized: normalized });
    }

    const digits = normalizePhoneForSearch(trimmed);
    if (digits) {
      conditions.push({ phone: { contains: digits } });
    }

    if (conditions.length === 0) {
      conditions.push({ leadCode: { equals: trimmed, mode: "insensitive" } });
    }

    return prisma.lead.findMany({
      where: {
        teamId,
        OR: conditions
      },
      select: {
        id: true,
        leadCode: true,
        name: true,
        status: true,
        phone: true,
        email: true,
      }
    });
  }

  private async generateLeadCode(name: string): Promise<string> {
    const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const firstLetter = (clean[0] || "L").toUpperCase();
    const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const digitsLength = 4 + Math.floor(Math.random() * 3);
      const digits = Array.from({ length: digitsLength }, () => Math.floor(Math.random() * 10)).join("");
      const code = `${firstLetter}${digits}${lastLetter}`;
      const existing = await leadRepository.findByLeadCode(code);
      if (!existing) {
        return code;
      }
    }

    const fallbackDigits = Date.now().toString().slice(-6);
    return `${firstLetter}${fallbackDigits}${lastLetter}`;
  }

  private async safeSendText(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    message: string;
  }) {
    try {
      await whatsAppCloudService.sendTextMessage(params);
    } catch (error) {
      console.error("Erro ao enviar mensagem WhatsApp:", error);
    }
  }
}

export const whatsAppBotUseCase = new WhatsAppBotUseCase();
