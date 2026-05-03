'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, CreditCard, Smartphone, Barcode, QrCode, Copy, Download, CheckCircle, Clock } from 'lucide-react';
import { ExternalLink } from '@/components/animate-ui/icons/external-link';
import type { Output } from '@/lib/output';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { StepIndicator } from './StepIndicator';
import { subscriptionSchema, type SubscriptionFormSchema } from '../validation/subscriptionSchema';
import { SubscriptionService } from '../services/SubscriptionService';
import { maskPhone, maskCPFOrCNPJ, maskCEP, unmask } from '@/lib/masks';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { useWebhookListener } from '@/hooks/useWebhookListener';
import { detectBrowserTimezone, formatIntimezone, parseDateKeyToUtc } from "@/lib/dates"

interface SubscriptionFormMultiStepProps {
  onSuccess: (
    customerId: string,
    subscriptionId: string,
    paymentUrl?: string,
    pix?: { encodedImage: string; payload: string; expirationDate: string },
    paymentId?: string,
    boleto?: { bankSlipUrl: string; identificationField: string; barCode: string; dueDate: string }
  ) => void;
  onError: (error: string) => void;
}

interface CheckSubscriptionResult {
  success: boolean;
  hasActiveSubscription: boolean;
  userExists: boolean;
  userId?: string;
  userRole?: string;
  matchSource?: 'email' | 'phone' | 'document';
  matchedIdentifier?: string;
}

export function SubscriptionFormMultiStep({
  onSuccess,
  onError,
}: SubscriptionFormMultiStepProps) {
  const browserTz = detectBrowserTimezone();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [billingType, setBillingType] = useState<'CREDIT_CARD' | 'PIX' | 'BOLETO'>('PIX');
  const [isStepValid, setIsStepValid] = useState(false);
  const [pixData, setPixData] = useState<{
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null>(null);
  const [boletoData, setBoletoData] = useState<{
    bankSlipUrl: string;
    identificationField: string;
    barCode: string;
    dueDate: string;
  } | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<{
    customerId: string;
    subscriptionId: string;
    paymentId?: string;
    paymentUrl?: string;
  } | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const service = new SubscriptionService();
  const router = useRouter();

  // Log para debug do estado do hook
  useEffect(() => {
    console.info('🔍 [SubscriptionFormMultiStep] Estado atual:', {
      currentStep,
      hasSubscriptionData: !!subscriptionData,
      subscriptionId: subscriptionData?.subscriptionId,
      hookEnabled: currentStep === 3 && !!subscriptionData?.subscriptionId
    });
  }, [currentStep, subscriptionData]);

  // Legacy webhook-redirect to sign-up removed. Pix/Boleto confirmation will be handled
  // in the SubscriptionSuccess step via PixPayment callback, redirecting to CRM.

  const form = useForm<SubscriptionFormSchema>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      fullName: '',
      email: '',
      cpfCnpj: '',
      phone: '',
      postalCode: '',
      address: '',
      addressNumber: '',
      complement: '',
      province: '',
      city: '',
      state: '',
      billingType: 'PIX',
      creditCard: {
        holderName: '',
        number: '',
        expiryMonth: '',
        expiryYear: '',
        ccv: '',
      },
    },
  });

  const steps = [
    { number: 1, title: 'Dados Pessoais', description: 'Informações básicas' },
    { number: 2, title: 'Endereço', description: 'Dados de localização' },
    { number: 3, title: 'Pagamento', description: 'Método de cobrança' },
  ];

  // Verifica se o step atual é válido
  const checkStepValidity = async () => {
    const isValid = await validateStep(currentStep);
    setIsStepValid(isValid);
  };

  // Observa mudanças nos campos do formulário
  useEffect(() => {
    const subscription = form.watch(() => {
      checkStepValidity();
    });
    return () => subscription.unsubscribe();
  }, [currentStep, billingType]);

  // Inicial check
  useEffect(() => {
    checkStepValidity();
  }, [currentStep]);

  // Prefill with logged-in user's profile when available
  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const { data: { user } } = await (supabase?.auth.getUser() || { data: { user: null } });
        if (!user) return;

        const res = await fetch(`/api/v1/profiles/${user.id}`);
        if (!res.ok) return;
        const payload = await res.json();
        if (!payload?.isValid || !payload?.result) return;
        const p = payload.result;
        // Set values only if field is empty to avoid overriding user input
        if (!form.getValues('fullName') && p.fullName) form.setValue('fullName', p.fullName);
        if (!form.getValues('email') && p.email) form.setValue('email', p.email);
        if (!form.getValues('phone') && p.phone) form.setValue('phone', p.phone);
        if (!form.getValues('cpfCnpj') && p.cpfCnpj) form.setValue('cpfCnpj', p.cpfCnpj);
      } catch (e) {
        console.warn('Prefill profile skipped:', e);
      }
    })();
  }, []);

  // Prefill from sign-up handoff (sessionStorage), then clear it
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem('subscribePrefill') : null;
      if (!raw) return;
      const prefill = JSON.parse(raw) as Partial<SubscriptionFormSchema> & { fullName?: string; email?: string; phone?: string };
      if (prefill.fullName && !form.getValues('fullName')) form.setValue('fullName', prefill.fullName);
      if (prefill.email && !form.getValues('email')) form.setValue('email', prefill.email);
      if (prefill.phone && !form.getValues('phone')) form.setValue('phone', prefill.phone);
      sessionStorage.removeItem('subscribePrefill');
    } catch (_) {
      // ignore
    }
  }, [form]);

  const validateStep = async (step: number): Promise<boolean> => {
    let fieldsToValidate: (keyof SubscriptionFormSchema)[] = [];

    switch (step) {
      case 1:
        fieldsToValidate = ['fullName', 'email', 'cpfCnpj', 'phone'];
        break;
      case 2:
        fieldsToValidate = ['postalCode', 'address', 'addressNumber', 'province', 'city', 'state'];
        break;
      case 3:
        fieldsToValidate = ['billingType'];
        if (billingType === 'CREDIT_CARD') {
          fieldsToValidate.push('creditCard');
        }
        break;
    }

    const result = await form.trigger(fieldsToValidate as any);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) return;

    // Verificar assinatura ativa ao sair do Step 1
    if (currentStep === 1) {
      setLoadingNext(true);
      try {
        const formData = form.getValues();
        const response = await fetch('/api/v1/subscriptions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            cpfCnpj: formData.cpfCnpj,
            phone: formData.phone,
          }),
        });

        const output: Output = await response.json();
        const result = output.isValid
          ? (output.result as CheckSubscriptionResult | null)
          : null;

        if (output.isValid && result?.hasActiveSubscription) {
          const label = result.matchSource === 'email'
            ? 'e-mail'
            : result.matchSource === 'phone'
              ? 'telefone'
              : result.matchSource === 'document'
                ? 'documento (CPF/CNPJ)'
                : undefined;
          const masked = result.matchSource === 'phone'
            ? `${(result.matchedIdentifier || '').substring(0,4)}****`
            : result.matchSource === 'document'
              ? `${(result.matchedIdentifier || '').substring(0,3)}***`
              : result.matchedIdentifier;
          const detail = label && masked ? ` associada ao ${label}: ${masked}` : '';
          toast.error(`Assinatura ativa encontrada${detail ? ` (${detail})` : '!'}`);
          onError('Você já possui uma assinatura ativa. Faça login para acessar sua conta.');
          return;
        }
      } catch (error: any) {
        console.error('❌ [SubscriptionFormMultiStep] Erro ao verificar assinatura:', error);
        // Em caso de erro, permitir continuar (fail-safe)
      } finally {
        setLoadingNext(false);
      }
    }

    // Ao avançar para o Step 3, criar a assinatura e carregar o pagamento
    if (currentStep === 2) {
      setLoadingNext(true);
      try {
        await createSubscriptionAndLoadPayment('PIX'); // PIX é o padrão
      } finally {
        setLoadingNext(false);
      }
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Função para criar assinatura e carregar o método de pagamento
  const createSubscriptionAndLoadPayment = async (paymentType: 'PIX' | 'BOLETO') => {
    // Se já criou a assinatura, apenas carregar o método de pagamento correspondente
    if (subscriptionData) {
      await loadPaymentMethod(paymentType);
      return;
    }

    console.info(`📝 [SubscriptionFormMultiStep] Criando assinatura com ${paymentType}...`);
    setLoadingPayment(true);

    try {
      const formData = form.getValues();
      // Atualizar o billingType no formData
      formData.billingType = paymentType;
      
      const result = await service.createSubscription(formData);

      console.info('📝 [SubscriptionFormMultiStep] Resultado:', {
        success: result.success,
        hasCustomerId: !!result.customerId,
        hasSubscriptionId: !!result.subscriptionId,
        hasPix: !!result.pix,
        hasBoleto: !!result.boleto,
      });

      if (result.success) {
        // Verificar se é assinatura existente com pagamento pendente
        if (result.existingSubscription && result.paymentStatus === 'PENDING') {
          console.info('♻️ [SubscriptionFormMultiStep] Recuperando pagamento pendente');
          toast.success('Pagamento pendente encontrado!');
        }

        // Nenhum armazenamento em sessionStorage é necessário no fluxo auth-first

        // Armazenar dados da assinatura
        setSubscriptionData({
          customerId: result.customerId!,
          subscriptionId: result.subscriptionId!,
          paymentId: result.paymentId,
          paymentUrl: result.paymentUrl,
        });

        // Armazenar dados do pagamento correspondente
        if (paymentType === 'PIX' && result.pix) {
          console.info('🔲 [SubscriptionFormMultiStep] Dados PIX carregados');
          setPixData({
            encodedImage: result.pix.encodedImage,
            payload: result.pix.payload,
            expirationDate: result.pix.expirationDate,
          });
        } else if (paymentType === 'BOLETO' && result.boleto) {
          console.info('📄 [SubscriptionFormMultiStep] Dados Boleto carregados');
          setBoletoData({
            bankSlipUrl: result.boleto.bankSlipUrl,
            identificationField: result.boleto.identificationField,
            barCode: result.boleto.barCode,
            dueDate: result.boleto.dueDate,
          });
        }
      } else {
        if (result.alreadyActive) {
          onError('Você já possui uma assinatura ativa. Faça login para acessar sua conta.');
        } else {
          onError(result.message);
        }
      }
    } catch (error: any) {
      console.error('❌ [SubscriptionFormMultiStep] Erro:', error);
      onError(error.message || 'Erro ao processar assinatura');
    } finally {
      setLoadingPayment(false);
    }
  };

  // Função para carregar apenas o método de pagamento (quando troca de tab)
  const loadPaymentMethod = async (paymentType: 'PIX' | 'BOLETO') => {
    // Se já carregou esse método, não carregar de novo
    if (paymentType === 'PIX' && pixData) return;
    if (paymentType === 'BOLETO' && boletoData) return;

    if (!subscriptionData) {
      console.warn('⚠️ [SubscriptionFormMultiStep] Nenhuma assinatura criada ainda');
      return;
    }

    console.info(`📝 [SubscriptionFormMultiStep] Carregando ${paymentType}...`);
    setLoadingPayment(true);

    try {
      const formData = form.getValues();
      formData.billingType = paymentType;
      
      const result = await service.createSubscription(formData);

      if (result.success) {
        if (paymentType === 'PIX' && result.pix) {
          console.info('🔲 [SubscriptionFormMultiStep] PIX carregado');
          setPixData({
            encodedImage: result.pix.encodedImage,
            payload: result.pix.payload,
            expirationDate: result.pix.expirationDate,
          });
        } else if (paymentType === 'BOLETO' && result.boleto) {
          console.info('📄 [SubscriptionFormMultiStep] Boleto carregado');
          setBoletoData({
            bankSlipUrl: result.boleto.bankSlipUrl,
            identificationField: result.boleto.identificationField,
            barCode: result.boleto.barCode,
            dueDate: result.boleto.dueDate,
          });
        }
      }
    } catch (error: any) {
      console.error('❌ [SubscriptionFormMultiStep] Erro ao carregar:', error);
      toast.error('Erro ao carregar método de pagamento');
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: SubscriptionFormSchema) => {
    console.info('📝 [SubscriptionFormMultiStep] Confirmando assinatura...');

    // Se já temos a assinatura criada, apenas chamar onSuccess
    if (subscriptionData) {
      console.info('✅ [SubscriptionFormMultiStep] Confirmando com dados já carregados:', {
        customerId: subscriptionData.customerId,
        subscriptionId: subscriptionData.subscriptionId,
        hasPix: !!pixData,
        hasBoleto: !!boletoData,
      });

      onSuccess(
        subscriptionData.customerId,
        subscriptionData.subscriptionId,
        subscriptionData.paymentUrl,
        pixData || undefined,
        subscriptionData.paymentId,
        boletoData || undefined
      );
      return;
    }

    // Se por algum motivo não criou ainda, criar agora
    console.warn('⚠️ [SubscriptionFormMultiStep] Assinatura não foi pré-carregada, criando agora...');
    setLoading(true);

    try {
      const result = await service.createSubscription(data);

      if (result.success) {
        if (result.existingSubscription && result.paymentStatus === 'PENDING') {
          toast.success('Pagamento pendente encontrado!');
        }

        onSuccess(
          result.customerId!,
          result.subscriptionId!,
          result.paymentUrl,
          result.pix,
          result.paymentId,
          result.boleto
        );
      } else {
        if (result.alreadyActive) {
          onError('Você já possui uma assinatura ativa. Faça login para acessar sua conta.');
        } else {
          onError(result.message);
        }
      }
    } catch (error: any) {
      console.error('❌ [SubscriptionFormMultiStep] Erro ao enviar:', error);
      onError(error.message || 'Erro ao processar assinatura');
    } finally {
      setLoading(false);
    }
  };

  // Auto-redirect when webhook confirms payment
  useWebhookListener({
    subscriptionId: subscriptionData?.subscriptionId ?? null,
    enabled: currentStep === 3,
    onPaymentConfirmed: async () => {
      toast.success('Assinatura ativada 🎉', {
        description: 'Pagamento confirmado! Redirecionando para sua área.',
        duration: 5000,
      });
      try {
        const supabase = createSupabaseBrowser();
        const { data: { user } } = await (supabase?.auth.getUser() || { data: { user: null } });
        // sinalizar para o CRM exibir um toast de boas-vindas
        try { sessionStorage.setItem('subscriptionJustActivated', '1'); } catch (_) { /* ignore */ }
        if (user?.id) {
          router.push(`/${user.id}/crm`);
          return;
        }
      } catch (_) { /* ignore */ }
      router.push('/sign-in?from=subscribe');
    },
  });

  return (
    <div className="w-full max-w-4xl mx-auto">
      <StepIndicator currentStep={currentStep} steps={steps} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Dados Pessoais */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Dados Pessoais</CardTitle>
                <CardDescription>Preencha suas informações pessoais para começar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="joao@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpfCnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            {...field}
                            value={maskCPFOrCNPJ(field.value)}
                            onChange={(e) => {
                              const masked = maskCPFOrCNPJ(e.target.value)
                              const unmasked = unmask(masked)
                              field.onChange(unmasked)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
                          {...field}
                          value={maskPhone(field.value)}
                          onChange={(e) => {
                            const masked = maskPhone(e.target.value)
                            const unmasked = unmask(masked)
                            field.onChange(unmasked)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Endereço */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
                <CardDescription>Informe seu endereço para cobrança</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000-000"
                          {...field}
                          value={maskCEP(field.value)}
                          onChange={(e) => {
                            const masked = maskCEP(e.target.value)
                            const unmasked = unmask(masked)
                            field.onChange(unmasked)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua Example" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="addressNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto 45" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="Centro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="São Paulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado (UF)</FormLabel>
                      <FormControl>
                        <Input placeholder="SP" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Pagamento */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Forma de Pagamento</CardTitle>
                <CardDescription>Escolha como deseja pagar sua assinatura</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={billingType}
                  onValueChange={(value) => {
                    const newBillingType = value as typeof billingType
                    setBillingType(newBillingType)
                    form.setValue("billingType", newBillingType)

                    // Carregar método de pagamento quando trocar de tab
                    if (newBillingType === "PIX" || newBillingType === "BOLETO") {
                      loadPaymentMethod(newBillingType)
                    }
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="PIX" className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      PIX
                    </TabsTrigger>
                    <TabsTrigger value="CREDIT_CARD" className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Cartão
                    </TabsTrigger>
                    <TabsTrigger value="BOLETO" className="flex items-center gap-2">
                      <Barcode className="h-4 w-4" />
                      Boleto
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="PIX" className="space-y-4 mt-6">
                    {pixData ? (
                      // Exibir QR Code real
                      <div className="text-center p-6 border rounded-lg bg-card">
                        <div className="mb-4">
                          <img
                            src={`data:image/png;base64,${pixData.encodedImage}`}
                            alt="QR Code PIX"
                            className="mx-auto w-64 h-64 border-4 border-primary rounded-lg"
                          />
                        </div>

                        <h3 className="font-semibold text-lg mb-2">Escaneie o QR Code</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Abra o app do seu banco e escaneie o código acima
                        </p>

                        <div className="p-4 bg-muted/50 rounded-lg mb-4">
                          <p className="text-xs font-medium mb-2">Ou copie o código:</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs break-all bg-background p-2 rounded">
                              {pixData.payload}
                            </code>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(pixData.payload)
                                toast.success("Código copiado!")
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Expira em:{" "}
                          {formatIntimezone(
                            new Date(pixData.expirationDate),
                            "dd/MM/yyyy HH:mm",
                            browserTz,
                          )}
                        </p>

                        {/* Indicador de aguardando confirmação via webhook */}
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center justify-center gap-3 mb-2">
                            <div className="relative">
                              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <div className="absolute -top-1 -right-1">
                                <span className="flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                </span>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              Aguardando confirmação do pagamento...
                            </p>
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                            Você será redirecionado automaticamente após a confirmação
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Loading ou placeholder
                      <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/30 relative">
                        <div className="relative">
                          <QrCode className="h-20 w-20 mx-auto mb-4 text-primary" />
                          {loadingPayment && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg mb-2">
                          {loadingPayment ? "Gerando QR Code..." : "Pagamento via PIX"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                          {loadingPayment
                            ? "Aguarde enquanto preparamos seu código de pagamento"
                            : "Após confirmar, você receberá um QR Code para realizar o pagamento instantaneamente"}
                        </p>
                        {!loadingPayment && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
                            <CheckCircle className="h-4 w-4" />
                            Aprovação imediata
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="CREDIT_CARD" className="space-y-4 mt-6">
                    <FormField
                      control={form.control}
                      name="creditCard.holderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome no Cartão</FormLabel>
                          <FormControl>
                            <Input placeholder="JOÃO SILVA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="creditCard.number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número do Cartão</FormLabel>
                          <FormControl>
                            <Input placeholder="0000 0000 0000 0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="creditCard.expiryMonth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mês</FormLabel>
                            <FormControl>
                              <Input placeholder="MM" maxLength={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="creditCard.expiryYear"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ano</FormLabel>
                            <FormControl>
                              <Input placeholder="YYYY" maxLength={4} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="creditCard.ccv"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CVV</FormLabel>
                            <FormControl>
                              <Input placeholder="000" maxLength={4} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="BOLETO" className="space-y-4 mt-6">
                    {boletoData ? (
                      // Exibir dados reais do boleto
                      <div className="space-y-4 p-6 border rounded-lg bg-card">
                        <div className="text-center mb-4">
                          <Barcode className="h-16 w-16 mx-auto mb-2 text-primary" />
                          <h3 className="font-semibold text-lg mb-1">Boleto Bancário Gerado</h3>
                          <p className="text-sm text-muted-foreground">
                            Vencimento:{" "}
                            {formatIntimezone(
                              parseDateKeyToUtc(boletoData.dueDate, browserTz),
                              "dd/MM/yyyy",
                              browserTz,
                            )}
                          </p>
                        </div>

                        {/* Linha Digitável */}
                        {boletoData.identificationField && (
                          <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-xs font-medium mb-2">Linha Digitável:</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs break-all bg-background p-2 rounded font-mono">
                                {boletoData.identificationField}
                              </code>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(boletoData.identificationField)
                                  toast.success("Linha digitável copiada!")
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Botões de Ação */}
                        <div className="flex gap-2">
                          {boletoData.bankSlipUrl && (
                            <>
                              <Button
                                type="button"
                                variant="default"
                                className="flex-1"
                                onClick={() => window.open(boletoData.bankSlipUrl, "_blank")}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Visualizar Boleto
                              </Button>
                              <Button type="button" variant="outline" className="flex-1" asChild>
                                <a
                                  href={boletoData.bankSlipUrl}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Baixar PDF
                                </a>
                              </Button>
                            </>
                          )}
                        </div>

                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            Pague em qualquer banco, casa lotérica ou via internet banking
                          </p>
                        </div>

                        {/* Indicador de aguardando confirmação via webhook */}
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center justify-center gap-3 mb-2">
                            <div className="relative">
                              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <div className="absolute -top-1 -right-1">
                                <span className="flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                </span>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              Aguardando confirmação do pagamento...
                            </p>
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                            Você será redirecionado automaticamente após a confirmação
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Loading ou placeholder
                      <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/30 relative">
                        <div className="relative">
                          <Barcode className="h-20 w-20 mx-auto mb-4 text-primary" />
                          {loadingPayment && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg mb-2">
                          {loadingPayment ? "Gerando Boleto..." : "Pagamento via Boleto Bancário"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                          {loadingPayment
                            ? "Aguarde enquanto preparamos seu boleto de pagamento"
                            : "Após confirmar, você receberá um boleto bancário para pagamento"}
                        </p>
                        {!loadingPayment && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-sm font-medium">
                            <Clock className="h-4 w-4" />
                            Aprovação em até 3 dias úteis
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || loading || loadingNext}
              className="cursor-pointer"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>

            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!isStepValid || loading || loadingNext}
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                {loadingNext ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar Assinatura"
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}
