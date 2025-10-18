import { Output } from '@/lib/output'
import type { IAsaasCustomerService } from '@/app/api/services/AsaasCustomer/IAsaasCustomerService'
import type { IAsaasSubscriptionService } from '@/app/api/services/AsaasSubscription/IAsaasSubscriptionService'
import { asaasCustomerService } from '@/app/api/services/AsaasCustomer/AsaasCustomerService'
import { asaasSubscriptionService } from '@/app/api/services/AsaasSubscription/AsaasSubscriptionService'
import prisma from '@/app/api/infra/data/prisma'

/**
 * Input para criação de assinatura manager (onboarding via landing page)
 */
export interface CreateSubscriptionInput {
  supabaseId?: string
  fullName: string
  email: string
  cpfCnpj: string
  phone?: string
  postalCode?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  city?: string
  state?: string
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
  creditCard?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
}

export interface CreateSubscriptionResult {
  profileId: string
  customerId: string
  subscriptionId: string
  paymentUrl?: string
}

/**
 * Responsável por orquestrar:
 * 1. Criar (ou reutilizar) Profile + usuário Supabase (delegado ao repository futuro - aqui simplificado)
 * 2. Criar cliente Asaas se não existir
 * 3. Criar assinatura base manager (R$ 59,90)
 * 4. Atualizar profile com dados da assinatura
 *
 * OBS: Para manter escopo controlado e evitar mais corrupção de arquivo, usamos prisma diretamente aqui
 * com TODO para extrair para repository específico de Subscription em refatoração posterior.
 */
export class CreateSubscriptionUseCase {
  constructor(
    private readonly customerService: IAsaasCustomerService = asaasCustomerService,
    private readonly subscriptionService: IAsaasSubscriptionService = asaasSubscriptionService
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<Output> {
    console.info('🚀 [CreateSubscriptionUseCase] Iniciando execução...');
    console.info('🚀 [CreateSubscriptionUseCase] Input:', { 
      email: input.email, 
      billingType: input.billingType,
      fullName: input.fullName 
    });
    
    try {
      const validationErrors: string[] = []
      if (!input.fullName) validationErrors.push('Full name is required')
      if (!input.email) validationErrors.push('Email is required')
      if (!input.cpfCnpj) validationErrors.push('CPF/CNPJ is required')
      if (!input.billingType) validationErrors.push('Billing type is required')

      if (validationErrors.length) {
        console.warn('⚠️ [CreateSubscriptionUseCase] Erros de validação:', validationErrors);
        return new Output(false, [], validationErrors, null)
      }

      // Debug: Ver o que está chegando
      console.info('🔍 [CreateSubscriptionUseCase] Dados recebidos:', {
        cpfCnpj: input.cpfCnpj,
        phone: input.phone,
        postalCode: input.postalCode
      });

      // Normalização básica
      const cpfCnpj = input.cpfCnpj?.replace(/\D/g, '') || ''
      const phone = input.phone?.replace(/\D/g, '') || ''
      const postalCode = input.postalCode?.replace(/\D/g, '') || ''

      // Validação adicional
      if (!cpfCnpj || cpfCnpj.length < 11) {
        return new Output(false, [], ['CPF/CNPJ é obrigatório e deve ter pelo menos 11 dígitos'], null)
      }

      if (!phone || phone.length < 10) {
        return new Output(false, [], ['Telefone é obrigatório e deve ter pelo menos 10 dígitos'], null)
      }

      console.info('✅ [CreateSubscriptionUseCase] Dados normalizados:', {
        cpfCnpj: `${cpfCnpj.substring(0, 3)}***`,
        cpfCnpjLength: cpfCnpj.length,
        phone: `${phone.substring(0, 4)}***`,
        phoneLength: phone.length
      });

      // 1. Verificar se já existe profile com este email
      console.info('📊 [CreateSubscriptionUseCase] Verificando profile existente...');
      const existingProfile = await prisma.profile.findFirst({ where: { email: input.email } })
      console.info('📊 [CreateSubscriptionUseCase] Profile encontrado:', !!existingProfile);
      
      if (existingProfile && existingProfile.subscriptionId) {
        console.warn('⚠️ [CreateSubscriptionUseCase] Profile já tem assinatura:', existingProfile.subscriptionId);
        
        // Verificar status da assinatura e dos pagamentos pendentes
        try {
          const subscription = await this.subscriptionService.getSubscription(existingProfile.subscriptionId)
          console.info('📋 [CreateSubscriptionUseCase] Status da assinatura:', subscription.status);
          
          // Buscar pagamentos pendentes
          const payments = await (this.subscriptionService as any).getSubscriptionPayments(
            existingProfile.subscriptionId,
            { limit: 1, offset: 0, status: 'PENDING' }
          )
          
          const pendingPayment = Array.isArray(payments) ? payments[0] : payments?.data?.[0]
          
          if (pendingPayment) {
            console.info('💰 [CreateSubscriptionUseCase] Pagamento pendente encontrado:', pendingPayment.id);
            console.info('💳 [CreateSubscriptionUseCase] billingType do pagamento:', pendingPayment.billingType);
            console.info('💳 [CreateSubscriptionUseCase] billingType solicitado:', input.billingType);
            
            // Verificar se o billingType do pagamento pendente é diferente do solicitado
            if (pendingPayment.billingType !== input.billingType) {
              console.warn('⚠️ [CreateSubscriptionUseCase] billingType diferente! Ignorando pagamento pendente e seguindo para criar novo.');
              // Não retornar aqui - deixar o fluxo continuar para criar um novo pagamento
            } else {
              // Se o billingType é o mesmo, retornar os dados do pagamento pendente
              const result: any = {
                profileId: existingProfile.id,
                customerId: existingProfile.asaasCustomerId,
                subscriptionId: existingProfile.subscriptionId,
                paymentId: pendingPayment.id,
                paymentStatus: 'PENDING',
                existingSubscription: true
              }
              
              // Se for PIX, obter QR Code
              if (pendingPayment.billingType === 'PIX') {
                try {
                  const pix = await (this.subscriptionService as any).getPixQrCode(pendingPayment.id)
                  result.pix = {
                    encodedImage: pix.encodedImage,
                    payload: pix.payload,
                    expirationDate: pix.expirationDate
                  };
                  console.info('🔲 [CreateSubscriptionUseCase] QR Code PIX recuperado para pagamento pendente');
                } catch (e) {
                  console.warn('⚠️ [CreateSubscriptionUseCase] Erro ao obter QR Code:', e)
                }
              }
              
              // Se for BOLETO, obter dados
              if (pendingPayment.billingType === 'BOLETO') {
                try {
                  const boletoIdentification = await this.subscriptionService.getBoletoIdentificationField(pendingPayment.id)
                  result.boleto = {
                    bankSlipUrl: pendingPayment.bankSlipUrl || pendingPayment.invoiceUrl,
                    identificationField: boletoIdentification.identificationField,
                    barCode: boletoIdentification.barCode,
                    dueDate: pendingPayment.dueDate
                  };
                  console.info('📄 [CreateSubscriptionUseCase] Dados do boleto recuperados para pagamento pendente');
                } catch (e) {
                  console.warn('⚠️ [CreateSubscriptionUseCase] Erro ao obter dados do boleto:', e)
                }
              }
              
              return new Output(
                true, 
                ['Pagamento pendente encontrado. Continue de onde parou!'], 
                [], 
                result
              )
            }
          }
          
          // Se não há pagamento pendente do tipo solicitado e a assinatura está ativa
          // Vamos verificar se há algum pagamento CONFIRMADO/RECEIVED
          if (subscription.status === 'ACTIVE') {
            // Verificar se já existe pagamento confirmado
            const confirmedPayments = await (this.subscriptionService as any).getSubscriptionPayments(
              existingProfile.subscriptionId,
              { limit: 1, offset: 0, status: 'RECEIVED' }
            )
            
            const hasConfirmedPayment = Array.isArray(confirmedPayments) 
              ? confirmedPayments.length > 0 
              : confirmedPayments?.data?.length > 0
            
            if (hasConfirmedPayment) {
              console.warn('✅ [CreateSubscriptionUseCase] Assinatura já está ativa e paga');
              return new Output(
                false, 
                [], 
                ['Você já possui uma assinatura ativa. Faça login para acessar sua conta.'], 
                { 
                  alreadyActive: true,
                  profileId: existingProfile.id,
                  customerId: existingProfile.asaasCustomerId,
                  subscriptionId: existingProfile.subscriptionId
                }
              )
            }
            
            // Se não tem pagamento confirmado, permitir criar um novo
            console.info('ℹ️ [CreateSubscriptionUseCase] Assinatura ativa mas sem pagamento confirmado. Criando novo pagamento...');
          }
        } catch (error) {
          console.error('❌ [CreateSubscriptionUseCase] Erro ao verificar assinatura:', error);
          // Em caso de erro, seguir com o fluxo normal de criação
        }
        
        // Se chegou aqui, usar a assinatura existente e criar um novo pagamento
        console.info('📋 [CreateSubscriptionUseCase] Usando assinatura existente para criar novo pagamento');
      }

      // Verificar se já existe profile (se sim, reutilizar)
      let customerId: string;
      let existingAsaasCustomerId = existingProfile?.asaasCustomerId;

      if (existingAsaasCustomerId) {
        // Reutilizar cliente Asaas existente
        customerId = existingAsaasCustomerId;
        console.info('♻️ [CreateSubscriptionUseCase] Reutilizando cliente Asaas:', customerId);
      } else {
        // Criar cliente Asaas (SEM criar profile ainda)
        console.info('💳 [CreateSubscriptionUseCase] Criando cliente Asaas...');
        console.info('💳 [CreateSubscriptionUseCase] Dados cliente:', {
          name: input.fullName,
          email: input.email,
          cpfCnpj: cpfCnpj.substring(0, 3) + '***',
          phone: phone?.substring(0, 4) + '***'
        });
        
        const customer = await this.customerService.createCustomer({
          name: input.fullName,
          email: input.email,
          cpfCnpj,
          phone,
          postalCode,
          address: input.address,
          addressNumber: input.addressNumber,
          complement: input.complement,
          province: input.province,
          externalReference: input.email // Usar email como referência temporária
        })
        
        customerId = customer.customerId;
        console.info('✅ [CreateSubscriptionUseCase] Cliente Asaas criado:', customerId);
      }

      // 3. Criar assinatura base (manager R$ 59,90). Serviço já força 59.90
      console.info('💰 [CreateSubscriptionUseCase] Criando assinatura Manager...');
      console.info('💰 [CreateSubscriptionUseCase] Tipo de pagamento:', input.billingType);
      
      const subscription = await this.subscriptionService.createManagerSubscription({
        customer: customerId,
        billingType: input.billingType,
        value: 59.90,
        cycle: 'MONTHLY',
        description: 'Lead Flow - Plano Manager',
        externalReference: input.email // Usar email como referência temporária
      })
      
      console.info('✅ [CreateSubscriptionUseCase] Assinatura criada:', subscription.subscriptionId);

      // 4. Se o usuário já está autenticado (auth-first), vincular assinatura ao Profile existente
      if (input.supabaseId) {
        try {
          console.info('🔗 [CreateSubscriptionUseCase] Vinculando assinatura ao Profile do usuário autenticado');
          const profile = await prisma.profile.findFirst({ where: { supabaseId: input.supabaseId } });
          if (!profile) {
            console.warn('⚠️ [CreateSubscriptionUseCase] Profile não encontrado para supabaseId informado');
          } else {
            const updateData: any = {
              asaasCustomerId: customerId,
              subscriptionId: subscription.subscriptionId,
              subscriptionPlan: 'manager_base',
            };

            // Completar campos básicos se ainda estiverem vazios
            if (!profile.fullName && input.fullName) updateData.fullName = input.fullName;
            if (!profile.email && input.email) updateData.email = input.email;
            if (!profile.phone && phone) updateData.phone = phone;
            if (!profile.cpfCnpj && cpfCnpj) updateData.cpfCnpj = cpfCnpj;
            if (!profile.postalCode && postalCode) updateData.postalCode = postalCode;
            if (!profile.address && input.address) updateData.address = input.address;
            if (!profile.addressNumber && input.addressNumber) updateData.addressNumber = input.addressNumber;
            if (!profile.complement && input.complement) updateData.complement = input.complement;
            if (!profile.city && input.city) updateData.city = input.city;
            if (!profile.state && input.state) updateData.state = input.state;

            await prisma.profile.update({ where: { id: profile.id }, data: updateData });
            console.info('✅ [CreateSubscriptionUseCase] Profile atualizado com IDs da assinatura');
          }
        } catch (e) {
          console.warn('⚠️ [CreateSubscriptionUseCase] Não foi possível atualizar o Profile do usuário autenticado:', e);
        }
      } else {
        // Caso não esteja autenticado, manter o comportamento antigo (profile será criado no sign-up)
        console.info('ℹ️ [CreateSubscriptionUseCase] Profile será criado no sign-up após confirmação de pagamento');
      }

      const result: CreateSubscriptionResult & { 
        email: string; 
        fullName: string; 
        cpfCnpj: string; 
        phone: string;
      } = {
        profileId: existingProfile?.id || '', // Se já havia profile, retorná-lo
        customerId: customerId,
        subscriptionId: subscription.subscriptionId,
        paymentUrl: (subscription as any)?.data?.invoiceUrl || undefined,
        email: input.email,
        fullName: input.fullName,
        cpfCnpj: cpfCnpj,
        phone: phone
      }

      // PIX: tentar obter primeiro payment e QR Code (se houver)
      if (input.billingType === 'PIX') {
        console.info('🔲 [CreateSubscriptionUseCase] Tentando obter QR Code PIX...');
        try {
          // Buscar payments da assinatura; normalmente o primeiro payment é criado automaticamente
          const payments = await (this.subscriptionService as any).getSubscriptionPayments(
            subscription.subscriptionId,
            { limit: 1, offset: 0, status: 'PENDING' }
          )
          console.info('📋 [CreateSubscriptionUseCase] Payments encontrados:', payments?.length || payments?.data?.length || 0);
          
          const firstPayment = Array.isArray(payments) ? payments[0] : payments?.data?.[0]
          if (firstPayment?.id) {
            console.info('🎫 [CreateSubscriptionUseCase] Gerando QR Code para payment:', firstPayment.id);
            const pix = await (this.subscriptionService as any).getPixQrCode(firstPayment.id)
            console.info('✅ [CreateSubscriptionUseCase] QR Code obtido:', {
              hasPayload: !!pix?.payload,
              hasEncodedImage: !!pix?.encodedImage,
              hasExpirationDate: !!pix?.expirationDate,
              payloadLength: pix?.payload?.length || 0
            });
            // Anexar PIX info ao result (client pode exibir QR e copiar payload)
            ;(result as any).pix = {
              encodedImage: pix.encodedImage,
              payload: pix.payload,
              expirationDate: pix.expirationDate
            };
            (result as any).paymentId = firstPayment.id;
          } else {
            console.warn('⚠️ [CreateSubscriptionUseCase] Nenhum payment pendente encontrado para gerar QR Code');
          }
        } catch (e) {
          console.warn('⚠️ [CreateSubscriptionUseCase] Não foi possível obter QR Code PIX imediatamente:', e)
        }
      }

      // BOLETO: obter URL do boleto do primeiro payment
      if (input.billingType === 'BOLETO') {
        console.info('📄 [CreateSubscriptionUseCase] Tentando obter dados do Boleto...');
        try {
          const payments = await (this.subscriptionService as any).getSubscriptionPayments(
            subscription.subscriptionId,
            { limit: 1, offset: 0, status: 'PENDING' }
          )
          console.info('📋 [CreateSubscriptionUseCase] Payments encontrados:', payments?.length || payments?.data?.length || 0);
          
          const firstPayment = Array.isArray(payments) ? payments[0] : payments?.data?.[0]
          if (firstPayment?.id) {
            console.info('� [CreateSubscriptionUseCase] Boleto para payment:', firstPayment.id);
            // Obter linha digitável e código de barras via API específica
            const boletoIdentification = await this.subscriptionService.getBoletoIdentificationField(firstPayment.id);
            
            // Anexar dados do boleto ao result
            ;(result as any).boleto = {
              bankSlipUrl: firstPayment.bankSlipUrl || firstPayment.invoiceUrl,
              identificationField: boletoIdentification.identificationField,
              barCode: boletoIdentification.barCode,
              dueDate: firstPayment.dueDate
            };
            (result as any).paymentId = firstPayment.id;
            console.info('✅ [CreateSubscriptionUseCase] Dados do boleto obtidos:', {
              hasBankSlipUrl: !!(result as any).boleto.bankSlipUrl,
              hasIdentificationField: !!(result as any).boleto.identificationField,
              hasBarCode: !!(result as any).boleto.barCode,
              dueDate: (result as any).boleto.dueDate
            });
          } else {
            console.warn('⚠️ [CreateSubscriptionUseCase] Nenhum payment pendente encontrado para obter boleto');
          }
        } catch (e) {
          console.warn('⚠️ [CreateSubscriptionUseCase] Não foi possível obter dados do boleto:', e)
        }
      }

      console.info('�🎉 [CreateSubscriptionUseCase] Use case concluído com sucesso!');
      console.info('📦 [CreateSubscriptionUseCase] Result final:', {
        profileId: result.profileId,
        customerId: result.customerId,
        subscriptionId: result.subscriptionId,
        hasPix: !!(result as any).pix,
        hasBoleto: !!(result as any).boleto,
        hasPaymentId: !!(result as any).paymentId,
        pixKeys: (result as any).pix ? Object.keys((result as any).pix) : [],
        boletoKeys: (result as any).boleto ? Object.keys((result as any).boleto) : []
      });
      return new Output(true, ['Subscription created successfully'], [], result)
    } catch (error: any) {
      console.error('❌ [CreateSubscriptionUseCase] Erro na execução:', error);
      console.error('❌ [CreateSubscriptionUseCase] Stack:', error.stack);
      return new Output(false, [], [error.message || 'Internal error creating subscription'], null)
    }
  }
}
