import type { IMetaLeadUseCase, CreateLeadFromMetaDTO, MetaLeadContext } from "./IMetaLeadUseCase";
import { Output } from "@/lib/output";
import { metaLeadService, type MetaWebhookPayload } from "../../services/MetaLeadService";
import { leadRepository } from "../../infra/data/repositories/lead/LeadRepository";
import { prisma } from "../../infra/data/prisma";
import { LeadStatus, ActivityType, HealthPlan, LeadSource } from "@prisma/client";
import { normalizePhone } from "@/lib/phone";

/**
 * MetaLeadUseCase
 * 
 * UseCase responsável por processar leads do Meta Lead Ads
 * - Recebe webhook do Meta
 * - Busca dados completos via Graph API
 * - Cria lead automaticamente no sistema
 * - Coloca na coluna "new_opportunity"
 */
export class MetaLeadUseCase implements IMetaLeadUseCase {
  
  /**
   * Processa um lead recebido do Meta Lead Ads
   */
  async processMetaLead(leadgenId: string, context: MetaLeadContext): Promise<Output> {
    try {
      // 1. Buscar dados do lead via Meta Graph API
      console.info(`📥 Buscando dados do lead ${leadgenId} no Meta...`);
      const metaData = await metaLeadService.getLeadData(leadgenId, context.pageAccessToken);
      
      if (!metaData) {
        return new Output(
          false,
          [],
          ['Não foi possível buscar dados do lead no Meta'],
          null
        );
      }

      // 3. Criar lead no sistema
      console.info(`📝 Criando lead no sistema para manager ${context.managerId}...`);
      
      const lead = await this.createLeadFromMeta({
        metaData,
        managerId: context.managerId,
        teamId: context.teamId ?? undefined,
        assignedTo: context.defaultAssigneeId ?? undefined,
        metaPageId: context.metaPageId ?? undefined
      });

      return new Output(
        true,
        ['Lead do Meta processado e criado com sucesso'],
        [],
        lead
      );

    } catch (error) {
      console.error('❌ Erro ao processar lead do Meta:', error);
      
      if (error instanceof Error) {
        return new Output(
          false,
          [],
          [`Erro ao processar lead: ${error.message}`],
          null
        );
      }
      
      return new Output(
        false,
        [],
        ['Erro interno ao processar lead do Meta'],
        null
      );
    }
  }

  /**
   * Processa webhook do Meta
   */
  async processWebhook(payload: MetaWebhookPayload, context: MetaLeadContext): Promise<Output> {
    try {
      // Validar estrutura do payload
      if (!payload.entry || payload.entry.length === 0) {
        return new Output(
          false,
          [],
          ['Payload do webhook inválido'],
          null
        );
      }

      const results: any[] = [];
      const errors: string[] = [];

      // Processar cada entry do webhook
      for (const entry of payload.entry) {
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') {
            continue;
          }

          const leadgenId = change.value?.leadgen_id;
          
          if (!leadgenId) {
            errors.push('leadgen_id não encontrado no webhook');
            continue;
          }

          console.info(`📨 Processando leadgen_id: ${leadgenId}`);

          // Processar lead
          const result = await this.processMetaLead(leadgenId, context);
          
          if (result.isValid) {
            results.push(result.result);
          } else {
            errors.push(...result.errorMessages);
          }
        }
      }

      if (results.length === 0 && errors.length > 0) {
        return new Output(
          false,
          [],
          errors,
          null
        );
      }

      return new Output(
        true,
        [`${results.length} lead(s) processado(s) com sucesso`],
        errors,
        results
      );

    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      
      return new Output(
        false,
        [],
        ['Erro interno ao processar webhook do Meta'],
        null
      );
    }
  }

  /**
   * Cria lead no sistema a partir dos dados do Meta
   */
  private async createLeadFromMeta(dto: CreateLeadFromMetaDTO): Promise<any> {
    const { metaData, managerId, assignedTo, teamId, metaPageId } = dto;

    try {
      if (metaData.leadgenId) {
        const existingByLeadgen = await prisma.lead.findFirst({
          where: {
            managerId,
            metaLeadgenId: metaData.leadgenId
          }
        });

        if (existingByLeadgen) {
          return existingByLeadgen;
        }
      }

      // Verificar se já existe lead com este email ou telefone
      const existingLead = await this.checkDuplicateLead(
        managerId,
        metaData.email,
        metaData.phone
      );

      if (existingLead) {
        console.warn(`⚠️  Lead duplicado encontrado: ${existingLead.id}`);
        
        // Adicionar atividade mencionando tentativa de duplicação
        await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            activities: {
              create: {
                type: ActivityType.note,
                body: `Tentativa de criação duplicada via Meta Lead Ads (leadgen_id: ${metaData.leadgenId})`,
                author: { connect: { id: managerId } }
              }
            }
          }
        });

        return existingLead;
      }

      // Mapear plano de saúde
      const healthPlan = this.mapHealthPlan(metaData.currentHealthPlan);
      const leadCode = await this.generateLeadCode(metaData.name || "Lead");

      let resolvedTeamId = teamId;
      if (!resolvedTeamId) {
        const team = await prisma.team.findFirst({
          where: { masterId: managerId },
          orderBy: [
            { isDefault: "desc" },
            { createdAt: "asc" },
          ],
          select: { id: true }
        });

        if (!team) {
          throw new Error("Time padrao nao encontrado para o manager.");
        }
        resolvedTeamId = team.id;
      }

      // Criar lead
      const lead = await leadRepository.create({
        manager: { connect: { id: managerId } },
        team: { connect: { id: resolvedTeamId } },
        leadCode,
        name: metaData.name,
        email: metaData.email || null,
        phone: metaData.phone || null,
        phoneNormalized: normalizePhone(metaData.phone) || null,
        age: metaData.age || null,
        currentHealthPlan: healthPlan,
        notes: metaData.notes,
        status: LeadStatus.new_opportunity,
        source: LeadSource.meta_lead_ads,
        metaLeadgenId: metaData.leadgenId,
        metaFormId: metaData.formId || null,
        metaAdId: metaData.adId || null,
        metaPageId: metaPageId || null,
        creator: { connect: { id: managerId } },
        updater: { connect: { id: managerId } },
        ...(assignedTo && {
          assignee: { connect: { id: assignedTo } }
        }),
        activities: {
          create: {
            type: ActivityType.note,
            body: `Lead importado automaticamente do Meta Lead Ads\n\nFormulário ID: ${metaData.formId || 'N/A'}\nAnúncio ID: ${metaData.adId || 'N/A'}\nCidade: ${metaData.city || 'N/A'}\n\nDados brutos: ${JSON.stringify(metaData.rawData, null, 2)}`,
            author: { connect: { id: managerId } }
          }
        }
      });

      console.info(`✅ Lead criado com sucesso: ${lead.id}`);

      return lead;

    } catch (error) {
      console.error('❌ Erro ao criar lead do Meta:', error);
      throw error;
    }
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

  /**
   * Verifica se já existe lead com email ou telefone
   */
  private async checkDuplicateLead(
    managerId: string,
    email?: string,
    phone?: string
  ): Promise<any | null> {
    try {
      if (email) {
        const byEmail = await prisma.lead.findFirst({
          where: {
            managerId,
            email
          }
        });
        if (byEmail) return byEmail;
      }

      if (phone) {
        const normalized = normalizePhone(phone);
        const byPhone = await prisma.lead.findFirst({
          where: {
            managerId,
            OR: [
              { phone },
              ...(normalized ? [{ phoneNormalized: normalized }] : [])
            ]
          }
        });
        if (byPhone) return byPhone;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Mapeia string de plano de saúde para enum
   */
  private mapHealthPlan(plan?: string): HealthPlan | null {
    if (!plan) return null;

    const planLower = plan.toLowerCase();

    const mapping: Record<string, HealthPlan> = {
      'amil': HealthPlan.AMIL,
      'bradesco': HealthPlan.BRADESCO,
      'hapvida': HealthPlan.HAPVIDA,
      'medsenior': HealthPlan.MEDSENIOR,
      'gndi': HealthPlan.GNDI,
      'notre dame': HealthPlan.GNDI,
      'omint': HealthPlan.OMINT,
      'plena': HealthPlan.PLENA,
      'porto seguro': HealthPlan.PORTO_SEGURO,
      'porto': HealthPlan.PORTO_SEGURO,
      'prevent senior': HealthPlan.PREVENT_SENIOR,
      'prevent': HealthPlan.PREVENT_SENIOR,
      'sulamerica': HealthPlan.SULAMERICA,
      'sul america': HealthPlan.SULAMERICA,
      'unimed': HealthPlan.UNIMED,
    };

    for (const [key, value] of Object.entries(mapping)) {
      if (planLower.includes(key)) {
        return value;
      }
    }

    return HealthPlan.OUTROS;
  }

}

// Instância singleton
export const metaLeadUseCase = new MetaLeadUseCase();
