import type { IMetaLeadUseCase, CreateLeadFromMetaDTO } from "./IMetaLeadUseCase";
import { Output } from "@/lib/output";
import { metaLeadService, type MetaWebhookPayload } from "../../services/MetaLeadService";
import { healthPlanService } from "../../services/healthPlans/HealthPlanService";
import { ActivityType } from "@prisma/client";
import { leadRepository } from "../../infra/data/repositories/lead/LeadRepository";
import type { LeadDuplicateByEmail } from "../../infra/data/repositories/lead/ILeadRepository";
import { leadActivityRepository } from "../../infra/data/repositories/leadActivity/LeadActivityRepository";
import { profileRepository } from "../../infra/data/repositories/profile/ProfileRepository";
import { teamRepository } from "../../infra/data/repositories/team/TeamRepository";
import { leadUseCase } from "../leads/leadUseCaseFactory";
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";

type MetaManagerLookup = { id: string; supabaseId: string | null };

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
  async processMetaLead(leadgenId: string, managerId?: string): Promise<Output> {
    try {
      // 1. Buscar dados do lead via Meta Graph API
      console.info(`📥 Buscando dados do lead ${leadgenId} no Meta...`);
      
      const metaData = await metaLeadService.getLeadData(leadgenId);
      
      if (!metaData) {
        return new Output(
          false,
          [],
          ['Não foi possível buscar dados do lead no Meta'],
          null
        );
      }

      // 2. Determinar manager
      const manager = await this.getManagerId(managerId);

      if (!manager) {
        return new Output(
          false,
          [],
          ['Manager não encontrado para processar o lead'],
          null
        );
      }

      if (!manager.supabaseId) {
        return new Output(
          false,
          [],
          ['Manager não possui autenticação vinculada'],
          null
        );
      }

      // 3. Criar lead no sistema
      console.info(`📝 Criando lead no sistema para manager ${manager.id}...`);

      const lead = await this.createLeadFromMeta({
        metaData,
        managerId: manager.id,
        supabaseId: manager.supabaseId,
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
  validateWebhookSignature(signature: string, rawBody: string): boolean {
    return metaLeadService.validateWebhookSignature(signature, rawBody);
  }

  async processWebhook(payload: MetaWebhookPayload, managerId?: string): Promise<Output> {
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
          const result = await this.processMetaLead(leadgenId, managerId);
          
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
    const { metaData, managerId, supabaseId, assignedTo } = dto;

    try {
      // Verificar se ja existe lead com este email
      const existingLead = await this.checkDuplicateLead(
        managerId,
        metaData.email
      );

      if (existingLead) {
        console.warn(`⚠️  Lead duplicado encontrado: ${existingLead.id}`);

        // Adicionar atividade mencionando tentativa de duplicação
        await leadActivityRepository.create({
          leadId: existingLead.id,
          type: ActivityType.note,
          body: `Tentativa de criação duplicada via Meta Lead Ads (leadgen_id: ${metaData.leadgenId})`,
          createdBy: managerId,
        });

        return existingLead;
      }

      // Mapear plano de saúde
      const healthPlan = await healthPlanService.resolvePlanNameFromText(metaData.currentHealthPlan);

      const defaultTeamId = await teamRepository.findDefaultTeamIdByMaster(managerId);

      if (!defaultTeamId) {
        throw new Error("Time padrao nao encontrado para o manager.");
      }

      const activityPayload = {
        kind: "lead_creation",
        channel: "webhook",
        provider: "meta",
        source: "meta_lead_ads",
        leadgenId: metaData.leadgenId,
        formId: metaData.formId ?? null,
        adId: metaData.adId ?? null,
        createdTime: metaData.createdTime ?? null,
        city: metaData.city ?? null,
        importedAt: new Date().toISOString(),
      };

      const leadData: CreateLeadRequest = {
        name: metaData.name,
        email: metaData.email || undefined,
        phone: metaData.phone || undefined,
        cnpj: undefined,
        age: metaData.age || undefined,
        currentHealthPlan: healthPlan || undefined,
        currentValue: undefined,
        referenceHospital: undefined,
        currentTreatment: undefined,
        meetingDate: undefined,
        meetingTitle: undefined,
        meetingNotes: undefined,
        meetingLink: undefined,
        notes: metaData.notes || undefined,
        assignedTo,
        closerId: undefined,
        ticket: undefined,
        contractDueDate: undefined,
        soldPlan: undefined,
        confirmDuplicate: true,
        originChannel: "meta_webhook",
        originMetadata: activityPayload,
      };

      const leadOutput = await leadUseCase.createLead(
        supabaseId,
        leadData,
        defaultTeamId,
        {
          authorAsStudio: true,
          body: `Lead importado automaticamente do Meta Lead Ads\n\nFormulário ID: ${metaData.formId || 'N/A'}\nAnúncio ID: ${metaData.adId || 'N/A'}\nCidade: ${metaData.city || 'N/A'}\n\nDados brutos: ${JSON.stringify(metaData.rawData, null, 2)}`,
          payload: activityPayload,
        },
        { autoScheduleMeeting: false }
      );

      if (!leadOutput.isValid) {
        throw new Error(leadOutput.errorMessages.join("; ") || "Erro ao criar lead via Meta Lead Ads");
      }

      const lead = leadOutput.result as { id: string };
      console.info(`✅ Lead criado com sucesso: ${lead.id}`);

      // `teamId` sobe junto porque o webhook precisa dele para invalidar o
      // cache do time — sem isso o lead fica invisível no board até o TTL.
      return { id: lead.id, teamId: defaultTeamId };

    } catch (error) {
      console.error('❌ Erro ao criar lead do Meta:', error);
      throw error;
    }
  }

  /**
   * Verifica se ja existe lead com email
   */
  private async checkDuplicateLead(
    managerId: string,
    email?: string
  ): Promise<LeadDuplicateByEmail | null> {
    try {
      if (!email) return null;
      return await leadRepository.findDuplicateByManagerAndEmail(managerId, email);
    } catch {
      return null;
    }
  }

  /**
   * Obtém ID + supabaseId do manager
   * Se não informado, busca o primeiro manager master ativo
   */
  private async getManagerId(managerId?: string): Promise<MetaManagerLookup | null> {
    try {
      if (managerId) {
        return await profileRepository.findIdentityById(managerId);
      }

      // Buscar primeiro manager master com assinatura ativa
      return await profileRepository.findFirstActiveMasterManager();
    } catch (error) {
      console.error('Erro ao buscar manager:', error);
      return null;
    }
  }
}

// Instância singleton
export const metaLeadUseCase = new MetaLeadUseCase();
