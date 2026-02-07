import crypto from 'crypto';
import { normalizePhone } from '@/lib/phone';

/**
 * MetaLeadService
 * 
 * Serviço para integração com Meta Lead Ads (Facebook/Instagram)
 * - Busca dados de leads via Graph API
 * - Valida webhooks do Meta (HMAC SHA256)
 */
export class MetaLeadService {
  private readonly graphApiUrl = 'https://graph.facebook.com/v21.0';
  private readonly appSecret: string;

  constructor() {
    this.appSecret = process.env.META_APP_SECRET || '';
    if (!this.appSecret) {
      console.warn('⚠️  META_APP_SECRET não configurado');
    }
  }

  private resolveAccessToken(accessToken?: string): string {
    const token = accessToken || process.env.META_ACCESS_TOKEN || '';
    if (!token) {
      throw new Error('META_ACCESS_TOKEN não configurado');
    }
    return token;
  }

  /**
   * Valida assinatura do webhook do Meta
   * 
   * @param signature - Header X-Hub-Signature-256 enviado pelo Meta
   * @param body - Corpo da requisição (string)
   * @returns true se válido, false caso contrário
   */
  validateWebhookSignature(signature: string, body: string): boolean {
    if (!this.appSecret) {
      console.error('🔐 META_APP_SECRET não configurado - não é possível validar assinatura');
      return false;
    }

    if (!signature) {
      console.error('🔐 Assinatura ausente no header X-Hub-Signature-256');
      return false;
    }

    // Meta envia no formato: sha256=<hash>
    const signatureHash = signature.replace('sha256=', '');
    
    // Calcular HMAC SHA256
    const expectedHash = crypto
      .createHmac('sha256', this.appSecret)
      .update(body)
      .digest('hex');

    console.info('🔐 Validando assinatura HMAC SHA256...');

    // Comparação segura contra timing attacks
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'hex'),
        Buffer.from(expectedHash, 'hex')
      );

      if (isValid) {
        console.info('✅ Assinatura válida!');
      } else {
        console.error('❌ Assinatura inválida! Possível tentativa de ataque.');
      }

      return isValid;
    } catch (error) {
      console.error('❌ Erro ao validar assinatura:', error);
      return false;
    }
  }

  /**
   * Busca dados completos de um lead via Graph API
   * 
   * @param leadgenId - ID do leadgen recebido no webhook
   * @returns Dados do lead formatados
   */
  async getLeadData(leadgenId: string, accessToken?: string): Promise<MetaLeadData | null> {
    const token = this.resolveAccessToken(accessToken);

    try {
      console.info(`🔍 Buscando dados do lead ${leadgenId} via Graph API...`);
      
      const url = `${this.graphApiUrl}/${leadgenId}?access_token=${token}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao buscar lead do Meta:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Meta API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      console.info('✅ Dados do lead recebidos com sucesso');
      console.info('📋 Campos recebidos:', data.field_data?.map((f: any) => f.name).join(', '));
      
      return this.transformMetaLeadData(data);
    } catch (error) {
      console.error('❌ Erro ao buscar dados do lead:', error);
      throw error;
    }
  }

  /**
   * Transforma dados do Meta para formato padronizado
   * 
   * @param metaData - Dados brutos do Meta
   * @returns Dados formatados
   */
  private transformMetaLeadData(metaData: any): MetaLeadData {
    const fieldData = metaData.field_data || [];
    
    // Mapear campos do formulário
    const fields: Record<string, string> = {};
    fieldData.forEach((field: any) => {
      const name = field.name;
      const value = field.values?.[0] || '';
      fields[name] = value;
    });

    return {
      leadgenId: metaData.id,
      createdTime: metaData.created_time,
      formId: metaData.form_id,
      adId: metaData.ad_id,
      name: fields.full_name || fields.name || '',
      email: fields.email || '',
      phone: normalizePhone(fields.phone_number || fields.phone || '') || '',
      age: fields.age || fields.idade || '',
      currentHealthPlan: fields.current_health_plan || fields.plano_atual || '',
      city: fields.city || fields.cidade || '',
      notes: this.buildNotesFromFields(fields),
      rawData: metaData
    };
  }

  /**
   * Lista todos os formulários de lead ads de uma página
   * 
   * @param pageId - ID da página do Facebook
   * @returns Lista de formulários
   */
  async getLeadgenForms(pageId: string, accessToken?: string): Promise<MetaLeadgenForm[]> {
    const token = this.resolveAccessToken(accessToken);

    try {
      console.info(`📋 Buscando formulários da página ${pageId}...`);
      
      const url = `${this.graphApiUrl}/${pageId}/leadgen_forms?access_token=${token}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao buscar formulários:', errorText);
        throw new Error(`Meta API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      console.info(`✅ ${data.data?.length || 0} formulário(s) encontrado(s)`);
      
      return data.data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar formulários:', error);
      throw error;
    }
  }

  /**
   * Lista todos os leads de um formulário específico
   * 
   * @param formId - ID do formulário
   * @param limit - Limite de leads (default: 100)
   * @returns Lista de leads do formulário
   */
  async getFormLeads(formId: string, accessToken?: string, limit: number = 100): Promise<MetaFormLead[]> {
    const token = this.resolveAccessToken(accessToken);

    try {
      console.info(`📊 Buscando leads do formulário ${formId}...`);
      
      const url = `${this.graphApiUrl}/${formId}/leads?limit=${limit}&access_token=${token}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao buscar leads do formulário:', errorText);
        throw new Error(`Meta API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      console.info(`✅ ${data.data?.length || 0} lead(s) encontrado(s) no formulário`);
      
      return data.data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar leads do formulário:', error);
      throw error;
    }
  }

  /**
   * Conta total de leads de um formulário
   * 
   * @param formId - ID do formulário
   * @returns Total de leads
   */
  async countFormLeads(formId: string, accessToken?: string): Promise<number> {
    try {
      const leads = await this.getFormLeads(formId, accessToken, 1000); // Busca até 1000
      return leads.length;
    } catch (error) {
      console.error('❌ Erro ao contar leads:', error);
      return 0;
    }
  }

  /**
   * Busca estatísticas de um formulário
   * 
   * @param formId - ID do formulário
   * @returns Estatísticas do formulário
   */
  async getFormStats(formId: string, accessToken?: string): Promise<MetaFormStats> {
    const token = this.resolveAccessToken(accessToken);

    try {
      console.info(`📈 Buscando estatísticas do formulário ${formId}...`);
      
      // Buscar informações do formulário
      const formUrl = `${this.graphApiUrl}/${formId}?fields=id,name,status,leads_count,created_time&access_token=${token}`;
      
      const response = await fetch(formUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ao buscar estatísticas:', errorText);
        throw new Error(`Meta API error: ${response.status} - ${errorText}`);
      }

      const formData = await response.json();
      
      // Buscar leads para contar
      const leads = await this.getFormLeads(formId, token, 1000);
      
      const stats: MetaFormStats = {
        formId: formData.id,
        formName: formData.name,
        status: formData.status,
        totalLeads: leads.length,
        createdTime: formData.created_time,
        leads: leads
      };

      console.info(`✅ Estatísticas obtidas: ${stats.totalLeads} leads`);
      
      return stats;
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Constrói notas a partir de campos customizados
   */
  private buildNotesFromFields(fields: Record<string, string>): string {
    const ignoredFields = ['full_name', 'name', 'email', 'phone_number', 'phone', 'age', 'idade', 'current_health_plan', 'plano_atual', 'city', 'cidade'];
    
    const customFields = Object.entries(fields)
      .filter(([key]) => !ignoredFields.includes(key))
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return customFields || 'Lead importado do Meta Lead Ads';
  }
}

/**
 * Tipos
 */
export interface MetaLeadData {
  leadgenId: string;
  createdTime: string;
  formId?: string;
  adId?: string;
  name: string;
  email: string;
  phone: string;
  age?: string;
  currentHealthPlan?: string;
  city?: string;
  notes: string;
  rawData: any;
}

export interface MetaLeadgenForm {
  id: string;
  name: string;
  status: string;
  leads_count?: number;
}

export interface MetaFormLead {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  form_id: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

export interface MetaFormStats {
  formId: string;
  formName: string;
  status: string;
  totalLeads: number;
  createdTime: string;
  leads: MetaFormLead[];
}

export interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      field: string;
      value: {
        ad_id?: string;
        form_id?: string;
        leadgen_id: string;
        created_time: number;
        page_id?: string;
        adgroup_id?: string;
      };
    }>;
  }>;
}

// Instância singleton
export const metaLeadService = new MetaLeadService();
