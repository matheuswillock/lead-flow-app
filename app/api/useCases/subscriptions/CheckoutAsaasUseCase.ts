import { Output } from "@/lib/output";
import { asaasFetch, asaasApi, createAsaasClient, type AsaasAccountId } from "@/lib/asaas";
import { getEmailService } from "@/lib/services/EmailService";
import { createSupabaseAdmin as createSupabaseAdminClient } from "@/lib/supabase/server";
import { getFullUrl } from "@/lib/utils/app-url";
import { addMonthsInTz, formatIntimezone, resolveTimezone, startOfDayInTz } from "@/lib/dates";
import { invalidateAccountAccessStatusCache } from "@/lib/cache/invalidation";
import type { UserRole } from "@prisma/client";
import {
  profileRepository as defaultProfileRepository,
  type IProfileRepository,
} from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { teamRepository as defaultTeamRepository } from "@/app/api/infra/data/repositories/team/TeamRepository";
import type { ITeamRepository } from "@/app/api/infra/data/repositories/team/ITeamRepository";
import { teamMembersRepository as defaultTeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import type { ITeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository";
import {
  pendingOperatorRepository as defaultPendingOperatorRepository,
} from "@/app/api/infra/data/repositories/pendingOperator/PendingOperatorRepository";
import type { IPendingOperatorRepository } from "@/app/api/infra/data/repositories/pendingOperator/IPendingOperatorRepository";
import {
  asaasCustomerGateway as defaultAsaasCustomerGateway,
} from "@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway";
import type { IAsaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/IAsaasCustomerGateway";

// Helper para detectar ambiente de produção
function getIsProduction() {
  const asaasEnv = process.env.ASAAS_ENV;
  if (asaasEnv) {
    return asaasEnv === 'production';
  }
  return process.env.NODE_ENV === 'production';
}

export interface CreateCheckoutData {
  supabaseId: string;
  fullName: string;
  email: string;
  phone: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  complement?: string;
  city?: string;
  state?: string;
  billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO';
}

export interface CreateOperatorCheckoutData {
  managerId: string;
  teamId?: string;
  operatorData: {
    name: string;
    email: string;
    role: string;
    functions?: ("SDR" | "CLOSER")[];
  };
}

export interface ICheckoutAsaasUseCase {
  createSubscriptionCheckout(data: CreateCheckoutData): Promise<Output>;
  createOperatorCheckout(data: CreateOperatorCheckoutData): Promise<Output>;
  processCheckoutPaid(checkoutId: string, account: AsaasAccountId): Promise<Output>;
  processOperatorCheckoutPaid(
    checkoutSessionId: string,
    paymentId: string,
    account: AsaasAccountId
  ): Promise<Output>;
}

/**
 * E4/E5 de [[10 — Fundações Multi-conta — Backend]]: este UseCase estava em
 * dipPrismaInUseCaseAllowlist/nonRepositoryDatabaseAccessAllowlist/
 * prismaIncludeAllowlist — tocá-lo (C33: filtro por conta em
 * processCheckoutPaid; DA5: criação de customer via gateway) obriga o
 * refactor DIP completo na mesma mudança (agents.md). Todo acesso a Prisma
 * passou para repositories injetados (SRP/DIP); as 3 entradas saem do
 * allowlist no mesmo PR.
 */
export class CheckoutAsaasUseCase implements ICheckoutAsaasUseCase {
  constructor(
    private readonly profileRepository: IProfileRepository = defaultProfileRepository,
    private readonly teamRepository: ITeamRepository = defaultTeamRepository,
    private readonly teamMembersRepository: ITeamMembersRepository = defaultTeamMembersRepository,
    private readonly pendingOperatorRepository: IPendingOperatorRepository = defaultPendingOperatorRepository,
    private readonly asaasCustomerGateway: IAsaasCustomerGateway = defaultAsaasCustomerGateway
  ) {}

  /**
   * Cria link de pagamento (checkout) no Asaas para assinatura
   * Retorna URL para redirecionar o cliente
   */
  async createSubscriptionCheckout(data: CreateCheckoutData): Promise<Output> {
    let asaasCustomerId: string | null = null;
    let customerWasCreated = false;
    let isFirstCheckoutAttempt = false;
    let profileId: string | null = null;

    try {
      console.info('🛒 [createSubscriptionCheckout] Iniciando criação de checkout:', {
        supabaseId: data.supabaseId,
        email: data.email
      });

      // 1. Buscar ou criar cliente Asaas
      const profile = await this.profileRepository.findBySupabaseId(data.supabaseId);

      if (!profile) {
        return new Output(false, [], ['Usuário não encontrado'], null);
      }

      profileId = profile.id;

      // Verificar se é a primeira tentativa de checkout (processo de registro)
      // Se não tem asaasCustomerId e não tem subscriptionId, é a primeira vez
      isFirstCheckoutAttempt = !profile.asaasCustomerId && !profile.subscriptionId;

      if (isFirstCheckoutAttempt) {
        console.info('🆕 [createSubscriptionCheckout] Primeira tentativa de checkout - rollback ativo');
      }

      asaasCustomerId = profile.asaasCustomerId;

      // Criar cliente no Asaas se não existir
      if (!asaasCustomerId) {
        console.info('👤 [createSubscriptionCheckout] Criando cliente no Asaas...');

        // Usar dados do Profile (recém-criado) ou fallback dos dados do request
        const mobilePhone = (profile.phone || data.phone)?.replace(/\D/g, '') || undefined;
        const cpfCnpj = (profile.cpfCnpj || data.cpfCnpj)?.replace(/\D/g, '') || undefined;
        const postalCode = (profile.postalCode || data.postalCode)?.replace(/\D/g, '') || '01310100';
        const address = profile.address || data.address || 'Não informado';
        const addressNumber = profile.addressNumber || data.addressNumber || 'S/N';
        const province = profile.neighborhood || data.neighborhood || 'Centro'; // Province = Bairro
        const complement = profile.complement || data.complement || undefined;
        const name = profile.fullName || data.fullName;
        const email = profile.email || data.email;

        console.info('📍 [createSubscriptionCheckout] Dados do cliente:', {
          name,
          email,
          postalCode,
          address,
          addressNumber,
          province,
          complement,
          dataSource: profile.neighborhood ? 'profile' : 'request',
        });

        try {
          // E5 de [[10 — Fundações Multi-conta — Backend]] (DA5/M4.8):
          // criação de customer via AsaasCustomerGateway — nunca POST
          // /customers direto. O gateway fixa externalReference = profile.id
          // (a conta antiga não tinha isso, plano §7.1) e notificationDisabled.
          const customer = await this.asaasCustomerGateway.createCustomer({
            profileId: profile.id,
            name,
            email,
            mobilePhone,
            cpfCnpj,
            postalCode,
            address,
            addressNumber,
            province,
            complement,
          });

          asaasCustomerId = customer.id;
          customerWasCreated = true;

          // Salvar customer ID no profile (marca asaasCustomerAccount=primary — M4.7)
          await this.profileRepository.updateAsaasCustomerId(profile.id, asaasCustomerId);

          console.info('✅ [createSubscriptionCheckout] Cliente Asaas criado:', asaasCustomerId);
        } catch (customerError: any) {
          console.error('❌ [createSubscriptionCheckout] Erro ao criar cliente Asaas:', customerError);
          return new Output(
            false,
            [],
            [`Erro ao criar cliente no sistema de pagamentos: ${customerError.message}`],
            null
          );
        }
      }

      // 2. Criar Asaas Checkout com assinatura recorrente
      // nextDueDate = data da PRIMEIRA cobrança (hoje, para cobrar no ato)
      // A segunda cobrança será automaticamente agendada para +1 mês (MONTHLY)
      const ownerTz = resolveTimezone(profile.timezone);
      const periodStart = startOfDayInTz(new Date(), ownerTz);
      const nextDueDateStr = formatIntimezone(periodStart, "yyyy-MM-dd HH:mm:ss", ownerTz);
      const endDate = addMonthsInTz(periodStart, 12, ownerTz);
      const endDateStr = formatIntimezone(endDate, "yyyy-MM-dd HH:mm:ss", ownerTz);

      console.info('📝 [createSubscriptionCheckout] Criando Asaas Checkout...');
      console.info('📅 [createSubscriptionCheckout] Datas da assinatura:', {
        firstPayment: nextDueDateStr,
        endDate: endDateStr,
        cycle: 'MONTHLY - próxima cobrança em +30 dias'
      });

      // ✅ IMPORTANTE: Asaas exige billingTypes com um único valor.
      // billingTypes: ['CREDIT_CARD'] habilita PIX, Boleto e Cartão no checkout.
      // ⚠️ LIMITAÇÃO ASAAS: chargeTypes RECURRENT só funciona com CREDIT_CARD
      // Para PIX/Boleto com assinatura, usamos DETACHED e criamos
      // subscription via webhook após o primeiro pagamento.
      const billingTypes = ['CREDIT_CARD'];
      const chargeTypes = ['DETACHED'];

      console.info('💳 [createSubscriptionCheckout] Configuração:', {
        billingTypes,
        chargeTypes,
        note: 'Múltiplas formas de pagamento - primeiro pagamento apenas'
      });

      const checkoutData: any = {
        customer: asaasCustomerId,
        billingTypes,
        chargeTypes,
        items: [
          {
            name: 'Plano Professional',
            description: 'Sistema completo de gestão de leads com pipeline Kanban, analytics em tempo real e gestão de equipe.',
            value: 59.90,
            quantity: 1,
          }
        ],
        callback: {
          successUrl: getFullUrl('/checkout-return'),
          cancelUrl: getFullUrl(`/sign-up?deleteUser=${data.supabaseId}`),
          expiredUrl: getFullUrl(`/sign-up?deleteUser=${data.supabaseId}`),
          autoRedirect: true,
        },
      };

      // ❌ IMPORTANTE: Com chargeTypes DETACHED não podemos incluir subscription
      // A subscription será criada via webhook após o primeiro pagamento ser confirmado
      // Isso permite que o usuário escolha PIX, Boleto ou Cartão
      console.info('ℹ️ [createSubscriptionCheckout] Checkout para primeiro pagamento');
      console.info('ℹ️ [createSubscriptionCheckout] Subscription será criada via webhook após confirmação');

      const checkout = await asaasFetch(asaasApi.checkouts, {
        method: 'POST',
        body: JSON.stringify(checkoutData),
      });

      console.info('✅ [createSubscriptionCheckout] Checkout criado:', checkout.id);

      // 3. Construir URL do checkout
      const checkoutUrl = `https://${getIsProduction() ? 'www' : 'sandbox'}.asaas.com/checkoutSession/show?id=${checkout.id}`;
      console.info('🔗 [createSubscriptionCheckout] Checkout URL:', checkoutUrl);

      // 3. Salvar informações no profile
      await this.profileRepository.markProfileCheckoutTrialStarted(profile.id);

      console.info('🎉 [createSubscriptionCheckout] Checkout criado com sucesso!');

      return new Output(
        true,
        ['Checkout criado com sucesso'],
        [],
        {
          checkoutUrl,
          checkoutId: checkout.id,
        }
      );

    } catch (error: any) {
      console.error('❌ [createSubscriptionCheckout] Erro:', error);

      // Traduzir mensagens de erro comuns do Asaas
      let errorMessage = error.message || 'Erro desconhecido';

      if (errorMessage.includes('domínio')) {
        errorMessage = 'Configure um domínio na sua conta Asaas para criar checkouts. Acesse: Minha Conta → Informações';
      }

      // ROLLBACK COMPLETO: Se é a primeira tentativa de checkout, deletar o usuário
      if (isFirstCheckoutAttempt && data.supabaseId) {
        console.warn('⚠️ [createSubscriptionCheckout] Primeira tentativa falhou - iniciando rollback completo do usuário');

        try {
          // 1. Deletar profile do banco de dados
          if (profileId) {
            console.info('🗑️ [createSubscriptionCheckout] Rollback: Deletando profile do banco...');
            const deleted = await this.profileRepository.deleteProfile(data.supabaseId);
            if (!deleted) {
              throw new Error('Falha ao deletar profile no rollback');
            }
            console.info('✅ [createSubscriptionCheckout] Profile deletado');
          }

          // 2. Deletar usuário do Supabase Auth
          const supabaseAdmin = createSupabaseAdminClient();
          if (supabaseAdmin) {
            console.info('🗑️ [createSubscriptionCheckout] Rollback: Deletando usuário do Supabase Auth...');
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
              data.supabaseId
            );

            if (deleteError) {
              console.error('❌ [createSubscriptionCheckout] Erro ao deletar usuário do Auth:', deleteError);
            } else {
              console.info('✅ [createSubscriptionCheckout] Usuário deletado do Auth');
            }
          }

          console.info('✅ [createSubscriptionCheckout] Rollback completo concluído');

          return new Output(
            false,
            [],
            [
              'Erro no processo de registro. Por favor, tente criar sua conta novamente.',
              `Detalhes: ${errorMessage}`
            ],
            null
          );

        } catch (rollbackError: any) {
          console.error('❌ [createSubscriptionCheckout] Erro crítico no rollback:', rollbackError);

          return new Output(
            false,
            [],
            [
              'Erro crítico no processo de registro.',
              'Entre em contato com o suporte informando este erro.',
              `Detalhes: ${errorMessage}`
            ],
            null
          );
        }
      }

      // Rollback parcial: Se não é primeira tentativa, apenas limpar asaasCustomerId
      if (customerWasCreated && asaasCustomerId) {
        try {
          console.warn('🔄 [createSubscriptionCheckout] Rollback parcial: Removendo asaasCustomerId...');
          await this.profileRepository.clearAsaasCustomerId(data.supabaseId);
          console.info('✅ [createSubscriptionCheckout] Rollback parcial concluído');
        } catch (rollbackError) {
          console.error('❌ [createSubscriptionCheckout] Erro no rollback parcial:', rollbackError);
        }
      }

      return new Output(
        false,
        [],
        [`Erro ao criar checkout: ${errorMessage}`],
        null
      );
    }
  }

  /**
   * Cria checkout para adicionar operador à assinatura existente do manager
   * Incrementa o valor da assinatura em +R$ 19,90
   */
  async createOperatorCheckout(data: CreateOperatorCheckoutData): Promise<Output> {
    let pendingOperatorId: string | null = null;

    try {
      console.info('🛒 [createOperatorCheckout] Iniciando criação de checkout para operador:', {
        managerId: data.managerId,
        operatorEmail: data.operatorData.email
      });

      // 1. Buscar manager e validar
      const manager = await this.profileRepository.findBySupabaseId(data.managerId);

      if (!manager) {
        return new Output(false, [], ['Manager não encontrado'], null);
      }

      if (manager.role !== 'manager') {
        return new Output(false, [], ['Apenas managers podem adicionar operadores'], null);
      }

      if (!manager.subscriptionStatus || manager.subscriptionStatus === 'canceled') {
        return new Output(false, [], ['Manager não possui assinatura ativa'], null);
      }

      if (!manager.asaasCustomerId) {
        return new Output(false, [], ['Manager não possui customer Asaas configurado'], null);
      }

      if (!manager.asaasSubscriptionId) {
        return new Output(false, [], ['Manager não possui assinatura Asaas configurada'], null);
      }

      // 2. Verificar se email do operador já existe
      const existingUser = await this.profileRepository.findByEmail(data.operatorData.email);

      if (existingUser) {
        return new Output(false, [], ['Email já está em uso'], null);
      }

      // 3. Criar pendingOperator no banco
      const resolvedTeamId = data.teamId;
      if (resolvedTeamId) {
        const team = await this.teamRepository.findMasterRef(resolvedTeamId);
        if (!team) {
          return new Output(false, [], ['Time não encontrado'], null);
        }
        if (team.masterId !== manager.id) {
          return new Output(false, [], ['Apenas o master do time pode adicionar operadores'], null);
        }
      }

      const pendingOperator = await this.pendingOperatorRepository.create({
        managerId: manager.id,
        teamId: resolvedTeamId ?? null,
        name: data.operatorData.name,
        email: data.operatorData.email,
        role: data.operatorData.role,
        functions: data.operatorData.functions ?? [],
        paymentId: 'pending',
        subscriptionId: manager.asaasSubscriptionId,
        paymentStatus: 'PENDING',
        paymentMethod: 'UNDEFINED',
      });

      pendingOperatorId = pendingOperator.id;
      console.info('💾 [createOperatorCheckout] PendingOperator criado:', pendingOperatorId);

      // 3.1 E4 (C22/DA2): o checkout novo (POST /checkouts) só existe na
      // conta primary. Enviar um asaasCustomerId legacy quebra com "invalid
      // customer" — resolve um par novo na primary via gateway (DA6) e
      // persiste no profile (mesmo padrão de createSubscriptionCheckout),
      // em vez de tentar reusar o cus_ legado.
      let operatorCheckoutCustomerId = manager.asaasCustomerId;
      if (manager.asaasCustomerAccount === 'legacy') {
        console.info(
          `🔁 [createOperatorCheckout] manager ${manager.id} tem customer legacy ` +
            `(${manager.asaasCustomerId}) — criando par novo na conta primary via gateway.`
        );
        const newCustomer = await this.asaasCustomerGateway.createCustomer({
          profileId: manager.id,
          name: manager.fullName || manager.email,
          email: manager.email,
          cpfCnpj: manager.cpfCnpj || undefined,
          phone: manager.phone || undefined,
          postalCode: manager.postalCode || undefined,
          address: manager.address || undefined,
          addressNumber: manager.addressNumber || undefined,
          complement: manager.complement || undefined,
          province: manager.neighborhood || undefined,
        });
        await this.profileRepository.updateAsaasCustomerId(manager.id, newCustomer.id);
        operatorCheckoutCustomerId = newCustomer.id;
      }

      // 4. Criar Asaas Checkout para licença adicional
      // Usar checkout hospedado do Asaas (permite escolher forma de pagamento)
      const ownerTz = resolveTimezone(manager.timezone);
      const periodStart = startOfDayInTz(new Date(), ownerTz);
      const nextDueDateStr = formatIntimezone(periodStart, "yyyy-MM-dd HH:mm:ss", ownerTz);
      const endDate = addMonthsInTz(periodStart, 12, ownerTz);
      const endDateStr = formatIntimezone(endDate, "yyyy-MM-dd HH:mm:ss", ownerTz);

      console.info('📝 [createOperatorCheckout] Criando Asaas Checkout...');
      console.info('📅 [createOperatorCheckout] Datas:', {
        firstPayment: nextDueDateStr,
        endDate: endDateStr,
      });

      const checkoutData: any = {
        customer: operatorCheckoutCustomerId,
        billingTypes: ['CREDIT_CARD'], // Apenas cartão para assinatura recorrente
        chargeTypes: ['RECURRENT'],
        subscription: {
          cycle: 'MONTHLY',
          nextDueDate: nextDueDateStr,
          endDate: endDateStr,
          externalReference: `pending-operator-${pendingOperatorId}`, // ExternalReference na subscription
        },
        items: [
          {
            name: 'Licença Operador',
            description: `Acesso completo à plataforma - ${data.operatorData.email}`,
            value: 19.90,
            quantity: 1,
          }
        ],
        callback: {
          successUrl: getFullUrl(`/${data.managerId}/manager-users?operatorAdded=true`),
          cancelUrl: getFullUrl(`/${data.managerId}/manager-users?operatorCanceled=true`),
          expiredUrl: getFullUrl(`/${data.managerId}/manager-users?operatorExpired=true`),
          autoRedirect: true,
        },
      };

      const checkout = await asaasFetch(asaasApi.checkouts, {
        method: 'POST',
        body: JSON.stringify(checkoutData),
      });

      console.info('✅ [createOperatorCheckout] Checkout criado:', checkout.id);

      // 5. Atualizar pendingOperator com checkoutId
      await this.pendingOperatorRepository.updatePaymentId(pendingOperatorId, checkout.id);

      // 6. Construir URL do checkout
      const checkoutUrl = `https://${getIsProduction() ? 'www' : 'sandbox'}.asaas.com/checkoutSession/show?id=${checkout.id}`;
      console.info('🔗 [createOperatorCheckout] Checkout URL:', checkoutUrl);

      console.info('🎉 [createOperatorCheckout] Checkout criado com sucesso!');

      return new Output(
        true,
        ['Checkout criado com sucesso'],
        [],
        {
          checkoutUrl,
          checkoutId: checkout.id,
          pendingOperatorId,
        }
      );

    } catch (error: any) {
      console.error('❌ [createOperatorCheckout] Erro:', error);

      // Rollback: deletar pendingOperator se foi criado
      if (pendingOperatorId) {
        try {
          console.warn('🔄 [createOperatorCheckout] Rollback: Deletando pendingOperator...');
          await this.pendingOperatorRepository.deleteById(pendingOperatorId);
          console.info('✅ [createOperatorCheckout] Rollback concluído');
        } catch (rollbackError) {
          console.error('❌ [createOperatorCheckout] Erro no rollback:', rollbackError);
        }
      }

      // Traduzir mensagens de erro comuns do Asaas
      let errorMessage = error.message || 'Erro desconhecido';

      if (errorMessage.includes('domínio')) {
        errorMessage = 'Configure um domínio na sua conta Asaas para criar checkouts. Acesse: Minha Conta → Informações';
      }

      return new Output(
        false,
        [],
        [`Erro ao criar checkout: ${errorMessage}`],
        null
      );
    }
  }

  /**
   * Processa webhook quando checkout de operador é pago
   * Incrementa assinatura do manager e cria operador
   * @param checkoutSessionId - ID da sessão de checkout (checkoutSession do payment)
   * @param paymentId - ID do pagamento confirmado
   * @param account - conta Asaas do evento (E4/C22): a cobrança e a
   * subscription novas criadas pelo checkout vivem nesta conta; a assinatura
   * ANTIGA do manager pode viver em outra (asaasSubscriptionAccount).
   */
  async processOperatorCheckoutPaid(
    checkoutSessionId: string,
    paymentId: string,
    account: AsaasAccountId
  ): Promise<Output> {
    try {
      console.info('💰 [processOperatorCheckoutPaid] Processando pagamento:', {
        checkoutSessionId,
        paymentId,
        account,
      });

      // 1. Buscar pendingOperator pelo checkoutSessionId (salvo como paymentId)
      const pendingOperator = await this.pendingOperatorRepository.findByPaymentIdWithManager(
        checkoutSessionId
      );

      if (!pendingOperator) {
        console.warn('⚠️ [processOperatorCheckoutPaid] PendingOperator não encontrado para checkoutSessionId:', checkoutSessionId);
        return new Output(false, [], ['Operador pendente não encontrado'], null);
      }

      if (pendingOperator.operatorCreated) {
        console.info('ℹ️ [processOperatorCheckoutPaid] Operador já foi criado anteriormente');
        return new Output(false, [], ['Operador já foi criado'], null);
      }

      // 2. Buscar payment no Asaas para obter subscription (nasceu no
      // checkout, na conta do evento).
      const eventClient = createAsaasClient(account);
      const payment = await eventClient.request(
        `${eventClient.endpoints.payments}/${paymentId}`,
        { method: 'GET' }
      );

      if (!payment.subscription) {
        console.warn('⚠️ [processOperatorCheckoutPaid] Pagamento não vinculado a subscription');
        return new Output(false, [], ['Pagamento não vinculado a assinatura'], null);
      }

      const newSubscriptionId = payment.subscription;
      console.info('📋 [processOperatorCheckoutPaid] Informações:', {
        paymentId,
        subscriptionId: newSubscriptionId,
        checkoutSessionId
      });

      // 3. CRÍTICO: Atualizar assinatura do manager no Asaas
      // Buscar assinatura antiga e nova
      const manager = pendingOperator.manager;
      const oldSubscriptionId = manager.asaasSubscriptionId;

      if (!oldSubscriptionId) {
        return new Output(false, [], ['Manager não possui assinatura anterior'], null);
      }

      console.info('🔍 [processOperatorCheckoutPaid] Buscando assinaturas:', {
        old: oldSubscriptionId,
        new: newSubscriptionId
      });

      // Achado Codex (PR #1137, P1) + achado cursor[bot] no mesmo PR: o
      // rethrow do E4 (webhook outbox) torna este método retryable — sem
      // barreira, uma retentativa após o PUT (mas antes do deleteById) leria
      // o valor JÁ incrementado e somaria +R$19,90 de novo. cursor[bot]
      // apontou que marcar o incremento SÓ DEPOIS do PUT ainda deixa uma
      // janela (queda entre o PUT e o markSubscriptionUpdated): o marcador
      // agora é gravado ANTES do PUT — reduz a janela insegura para "gravou
      // a marca mas nem chegou a chamar o PUT" (bem mais estreita que "PUT
      // respondeu 200 mas a escrita no nosso banco falhou"). Efeito colateral
      // aceito conscientemente: se o PUT falhar DEPOIS de marcado, a
      // assinatura fica temporariamente abaixo do valor correto até
      // reconciliação manual — pior cenário é sub-cobrança, nunca dupla
      // cobrança (a assimetria certa: nunca cobrar duas vezes).
      if (pendingOperator.paymentStatus !== 'SUBSCRIPTION_UPDATED') {
        await this.pendingOperatorRepository.markSubscriptionUpdated(pendingOperator.id);

        // E4 (C22/DA2): a assinatura ANTIGA do manager roteia pela conta onde
        // ela de fato vive — pode ser diferente da conta do evento/checkout.
        const oldSubscriptionAccount = manager.asaasSubscriptionAccount;
        const oldSubscriptionClient = createAsaasClient(oldSubscriptionAccount);

        // Buscar valor atual da assinatura antiga
        const oldSubscription = await oldSubscriptionClient.request(
          `${oldSubscriptionClient.endpoints.subscriptions}/${oldSubscriptionId}`,
          { method: 'GET' }
        );

        const newValue = oldSubscription.value + 19.90;
        console.info('💰 [processOperatorCheckoutPaid] Incrementando valor:', {
          oldValue: oldSubscription.value,
          newValue,
          increment: 19.90
        });

        try {
          // Atualizar assinatura antiga com novo valor
          await oldSubscriptionClient.request(
            `${oldSubscriptionClient.endpoints.subscriptions}/${oldSubscriptionId}`,
            {
              method: 'PUT',
              body: JSON.stringify({ value: newValue })
            }
          );
          console.info('✅ [processOperatorCheckoutPaid] Assinatura do manager atualizada');
        } catch (incrementError) {
          // Marcador já gravado (para nunca dobrar a cobrança numa
          // retentativa) mas o incremento pode não ter sido aplicado de
          // fato — precisa de reconciliação manual, log distinto e
          // greppável para não passar despercebido.
          console.error(
            '🚨 [processOperatorCheckoutPaid] PUT de incremento falhou APÓS marcar SUBSCRIPTION_UPDATED — ' +
              'assinatura pode estar sub-cobrada, requer reconciliação manual',
            { managerId: manager.id, oldSubscriptionId, pendingOperatorId: pendingOperator.id, incrementError }
          );
          throw incrementError;
        }
      } else {
        console.info(
          '↩️ [processOperatorCheckoutPaid] Assinatura já incrementada em tentativa anterior — pulando PUT'
        );
      }

      // Cancelar nova subscription (usamos apenas para gerar o checkout —
      // nasceu na conta do evento, mesmo client do payment acima).
      try {
        await eventClient.request(
          `${eventClient.endpoints.subscriptions}/${newSubscriptionId}`,
          {
            method: 'DELETE'
          }
        );
        console.info('✅ [processOperatorCheckoutPaid] Nova subscription cancelada');
      } catch (cancelError) {
        console.warn('⚠️ [processOperatorCheckoutPaid] Erro ao cancelar nova subscription:', cancelError);
        // Não bloqueia o fluxo
      }

      // 4. Criar usuário no Supabase Auth
      console.info('👤 [processOperatorCheckoutPaid] Criando usuário no Supabase...');

      const supabaseAdmin = createSupabaseAdminClient();
      if (!supabaseAdmin) {
        return new Output(false, [], ['Erro ao conectar com autenticação'], null);
      }

      // Gerar senha temporária
      const tempPassword = Math.random().toString(36).slice(-12);

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: pendingOperator.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: pendingOperator.name,
          role: pendingOperator.role,
          manager_id: manager.supabaseId,
        }
      });

      if (authError || !authUser?.user) {
        console.error('❌ [processOperatorCheckoutPaid] Erro ao criar usuário:', authError);
        return new Output(false, [], ['Erro ao criar usuário no sistema de autenticação'], null);
      }

      console.info('✅ [processOperatorCheckoutPaid] Usuário criado no Supabase:', authUser.user.id);

      // 5. Criar perfil do operador no banco
      const operator = await this.profileRepository.createOperatorProfileFromPendingOperator({
        supabaseId: authUser.user.id,
        fullName: pendingOperator.name,
        email: pendingOperator.email,
        role: pendingOperator.role as UserRole,
        functions: (pendingOperator.functions ?? []) as ("SDR" | "CLOSER")[],
        managerId: manager.id,
      });

      console.info('✅ [processOperatorCheckoutPaid] Operador criado no banco:', operator.id);

      // 5.1 Vincular operador ao time (TeamMember)
      let targetTeamId = pendingOperator.teamId;
      if (!targetTeamId) {
        targetTeamId = await this.teamRepository.findDefaultTeamIdByMaster(manager.id);
      }

      if (targetTeamId) {
        const existingMember = await this.teamMembersRepository.findExistingMember(
          targetTeamId,
          operator.id
        );

        if (!existingMember) {
          await this.teamMembersRepository.createMember({
            teamId: targetTeamId,
            profileId: operator.id,
            role: (pendingOperator.role || 'operator') as UserRole,
            functions: (pendingOperator.functions ?? []) as ("SDR" | "CLOSER")[],
          });
        }
      }

      // 6. Deletar pendingOperator (já foi processado)
      await this.pendingOperatorRepository.deleteById(pendingOperator.id);

      console.info('✅ [processOperatorCheckoutPaid] PendingOperator removido da fila');

      // 7. Incrementar contador de operadores no manager
      await this.profileRepository.incrementOperatorCount(manager.id);

      console.info('✅ [processOperatorCheckoutPaid] Contador do manager incrementado');

      // 8. Enviar e-mail de convite para operador
      try {
        const emailService = getEmailService();
        const inviteUrl = getFullUrl('/set-password');

        await emailService.sendOperatorInviteEmail({
          operatorName: pendingOperator.name,
          operatorEmail: pendingOperator.email,
          operatorRole: pendingOperator.role,
          managerName: manager.fullName || manager.email,
          inviteUrl,
        });

        console.info('✅ [processOperatorCheckoutPaid] E-mail de convite enviado');
      } catch (emailError) {
        console.warn('⚠️ [processOperatorCheckoutPaid] Erro ao enviar e-mail:', emailError);
        // Não bloqueia o fluxo
      }

      console.info('🎉 [processOperatorCheckoutPaid] Operador criado com sucesso!');

      return new Output(
        true,
        ['Operador criado com sucesso'],
        [],
        {
          operatorId: operator.id,
          operatorEmail: operator.email,
        }
      );

    } catch (error: any) {
      console.error('❌ [processOperatorCheckoutPaid] Erro:', error);

      return new Output(
        false,
        [],
        ['Erro ao processar pagamento do operador'],
        null
      );
    }
  }

  /**
   * Processa webhook quando checkout é pago
   * Ativa a conta do usuário
   *
   * @param account Conta Asaas do evento (E4/T-10.11 — C33): o lookup por
   * asaasSubscriptionId filtra por ela para não ativar/atualizar o profile
   * errado numa colisão de sub_ entre as duas contas.
   */
  async processCheckoutPaid(checkoutId: string, account: AsaasAccountId): Promise<Output> {
    try {
      console.info('💰 [processCheckoutPaid] Processando pagamento de checkout:', { checkoutId, account });

      // Buscar cobrança no Asaas para obter subscription (C33: a cobrança
      // pertence à conta do evento, não sempre à primary — buscar na conta
      // errada retorna 404 ou, pior, lê o ID de outra conta).
      const asaasClient = createAsaasClient(account);
      const payment = await asaasClient.request(
        `${asaasClient.endpoints.payments}/${checkoutId}`,
        { method: 'GET' }
      );

      if (!payment.subscription) {
        return new Output(
          false,
          [],
          ['Cobrança não está vinculada a uma assinatura'],
          null
        );
      }

      // Buscar profile pela assinatura (C33: filtrado pela conta do evento)
      const profile = await this.profileRepository.findByAsaasSubscriptionIdAndAccount(
        payment.subscription,
        account
      );

      if (!profile) {
        return new Output(
          false,
          [],
          ['Usuário não encontrado para esta assinatura'],
          null
        );
      }

      // Atualizar status da assinatura para ativa
      await this.profileRepository.activateSubscription(profile.id);

      invalidateAccountAccessStatusCache({ accountMasterId: profile.id });

      console.info('✅ [processCheckoutPaid] Assinatura ativada para:', profile.email);

      // Enviar e-mail de boas-vindas
      try {
        const emailService = getEmailService();
        const loginUrl = getFullUrl('/sign-in');

        await emailService.sendWelcomeEmail({
          userName: profile.fullName || profile.email,
          userEmail: profile.email,
          loginUrl,
        });

        console.info('✅ [processCheckoutPaid] E-mail de boas-vindas enviado para:', profile.email);
      } catch (emailError) {
        console.error('⚠️ [processCheckoutPaid] Erro ao enviar e-mail de boas-vindas:', emailError);
        // Não bloqueia o fluxo principal
      }

      return new Output(
        true,
        ['Assinatura ativada com sucesso'],
        [],
        { supabaseId: profile.supabaseId }
      );

    } catch (error: any) {
      console.error('❌ [processCheckoutPaid] Erro:', error);

      return new Output(
        false,
        [],
        ['Erro ao processar pagamento'],
        null
      );
    }
  }
}

export const checkoutAsaasUseCase = new CheckoutAsaasUseCase();
