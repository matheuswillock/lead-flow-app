"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSignUpForm } from "@/hooks/useForms";
import { SignupForm } from "@/components/forms/signUpForm";
import { useSignUp } from "./signUpContext";
import { signUpFormData } from "@/lib/validations/validationForms";
import { getEncryptedData, removeEncryptedData } from "@/lib/crypto";
import type { PendingSignUpData } from "@/types/subscription";
import { toast } from "sonner";

/**
 * Componente interno que usa o context
 * Separado para poder usar o hook useSignUp
 */
export function SignUpFormContainer() {
    const searchParams = useSearchParams();
    const form = useSignUpForm();
    const { isLoading, errors, registerUser } = useSignUp();
    const [pendingData, setPendingData] = useState<PendingSignUpData | null>(null);
    const [dataExpired, setDataExpired] = useState(false);

    // Recuperar dados criptografados do sessionStorage
    useEffect(() => {
        console.info('🏁 [SignUpFormContainer] Componente renderizado (client-side)');
        console.info('🔍 [SignUpFormContainer] Window location:', window.location.href);
        console.info('📋 [SignUpFormContainer] SessionStorage keys:', Object.keys(sessionStorage));
        console.info('💾 [SignUpFormContainer] pendingSignUp exists:', !!sessionStorage.getItem('pendingSignUp'));
        console.info('🔍 [SignUpFormContainer] searchParams obtido:', searchParams.toString());
        console.info('🎬 [SignUpFormContainer] useEffect executado');
        console.info('🔍 [SignUpFormContainer] searchParams:', {
            from: searchParams.get('from'),
            fromSubscription: searchParams.get('from') === 'subscription'
        });
        
        const fromSubscription = searchParams.get('from') === 'subscription';
        
        if (fromSubscription) {
            console.info('🔍 [SignUpFormContainer] Buscando dados criptografados...');
            
            // Recuperar dados criptografados
            const data = getEncryptedData<PendingSignUpData>('pendingSignUp');
            
            console.info('📦 [SignUpFormContainer] Dados recuperados:', {
                encontrado: !!data,
                temSubscriptionConfirmed: !!data?.subscriptionConfirmed,
                temSubscriptionId: !!data?.subscriptionId,
                temCustomerId: !!data?.customerId,
                subscriptionId: data?.subscriptionId,
                customerId: data?.customerId
            });
            
            if (data?.subscriptionConfirmed) {
                console.info('✅ [SignUpFormContainer] Dados encontrados!');
                console.info('📦 [SignUpFormContainer] subscriptionId:', data.subscriptionId);
                console.info('📦 [SignUpFormContainer] customerId:', data.customerId);
                console.info('📦 [SignUpFormContainer] timestamp:', data.timestamp);
                
                // Validar se dados não expiraram (30 minutos)
                const age = Date.now() - new Date(data.timestamp).getTime();
                const maxAge = 30 * 60 * 1000; // 30 minutos
                
                console.info('⏰ [SignUpFormContainer] Idade dos dados:', `${Math.floor(age / 1000)}s / ${Math.floor(maxAge / 1000)}s`);
                
                if (age > maxAge) {
                    console.warn('⚠️ [SignUpFormContainer] Dados expirados');
                    setDataExpired(true);
                    removeEncryptedData('pendingSignUp');
                    toast.error('Sessão expirada', {
                        description: 'Por favor, faça uma nova assinatura.',
                    });
                    setTimeout(() => {
                        window.location.href = '/subscribe';
                    }, 3000);
                    return;
                }
                
                console.info('✅ [SignUpFormContainer] Dados recuperados com sucesso');
                setPendingData(data);
                
                // Pre-preencher formulário
                form.setValue('fullName', data.fullName);
                form.setValue('email', data.email);
                form.setValue('phone', data.phone);
                
                toast.success('Pagamento confirmado!', {
                    description: 'Complete seu cadastro para acessar a plataforma.',
                    duration: 5000,
                });
            } else {
                console.warn('⚠️ [SignUpFormContainer] Dados não encontrados ou inválidos');
                toast.warning('Nenhuma assinatura pendente', {
                    description: 'Você pode fazer seu cadastro normalmente.',
                });
            }
        }
        
        // Fallback: Tentar carregar da URL (compatibilidade com código antigo)
        const fullName = searchParams.get('fullName');
        const email = searchParams.get('email');
        const cpfCnpj = searchParams.get('cpfCnpj');
        const phone = searchParams.get('phone');
        const asaasCustomerId = searchParams.get('asaasCustomerId');
        const subscriptionId = searchParams.get('subscriptionId');

        if (fullName && email && cpfCnpj && phone) {
            console.info('🔒 [SignUpFormContainer] Pré-preenchendo formulário com dados da URL (fallback)');
            
            form.setValue('fullName', fullName);
            form.setValue('email', email);
            form.setValue('phone', phone);
            
            // Armazenar IDs do Asaas para usar no cadastro
            if (asaasCustomerId && subscriptionId) {
                sessionStorage.setItem('asaasData', JSON.stringify({
                    asaasCustomerId,
                    subscriptionId,
                    cpfCnpj,
                }));
            }
        }
    }, [searchParams, form]);

    async function onSubmit(data: signUpFormData) {
        console.info('🚀 [SignUpFormContainer] onSubmit iniciado');
        console.info('📦 [SignUpFormContainer] pendingData:', pendingData);
        
        // Verificar se temos dados criptografados (prioridade)
        if (pendingData) {
            console.info('✅ [SignUpFormContainer] Incluindo dados da assinatura no registro');
            console.info('🔑 [SignUpFormContainer] subscriptionId:', pendingData.subscriptionId);
            console.info('🔑 [SignUpFormContainer] customerId:', pendingData.customerId);
            
            // Adicionar TODOS os dados do pendingData ao payload
            (data as any).cpfCnpj = pendingData.cpfCnpj;
            (data as any).postalCode = pendingData.postalCode;
            (data as any).address = pendingData.address;
            (data as any).addressNumber = pendingData.addressNumber;
            (data as any).complement = pendingData.complement;
            (data as any).city = pendingData.city;
            (data as any).state = pendingData.state;
            (data as any).asaasCustomerId = pendingData.customerId;
            (data as any).subscriptionId = pendingData.subscriptionId;
            (data as any).subscriptionStatus = 'active'; // Status active após pagamento confirmado
            (data as any).subscriptionPlan = 'manager_base';
            (data as any).role = 'manager';
            (data as any).operatorCount = 0; // Inicialmente sem operadores
            (data as any).subscriptionStartDate = new Date(); // Data de início da assinatura
            // trialEndDate não é enviado para manager_base, apenas para free_trial
            
            console.info('📤 [SignUpFormContainer] Payload final com assinatura:', {
                hasSubscriptionId: !!(data as any).subscriptionId,
                hasCustomerId: !!(data as any).asaasCustomerId,
                subscriptionPlan: (data as any).subscriptionPlan,
                operatorCount: (data as any).operatorCount
            });
            
            // Limpar dados criptografados após usar
            removeEncryptedData('pendingSignUp');
            console.info('🗑️ [SignUpFormContainer] Dados criptografados removidos');
        } else {
            // Fallback: Verificar se temos dados do Asaas no sessionStorage (método antigo)
            const asaasDataStr = sessionStorage.getItem('asaasData');
            if (asaasDataStr) {
                const asaasData = JSON.parse(asaasDataStr);
                console.info('✅ [SignUpFormContainer] Incluindo dados do Asaas no registro (fallback)');
                
                (data as any).asaasCustomerId = asaasData.asaasCustomerId;
                (data as any).subscriptionId = asaasData.subscriptionId;
                (data as any).cpfCnpj = asaasData.cpfCnpj;
                (data as any).subscriptionStatus = 'active';
                
                // Limpar sessionStorage após usar
                sessionStorage.removeItem('asaasData');
                sessionStorage.removeItem('subscriptionFormData');
            }
        }

        const result = await registerUser(data);

        if (result.isValid && result.result?.supabaseId) {
            // Sucesso - redirecionar para board com supabaseId
            toast.success('Cadastro concluído!', {
                description: 'Redirecionando para sua área de trabalho...',
            });
            
            setTimeout(() => {
                window.location.href = `/${result.result.supabaseId}/board`;
            }, 1500);
        }
        // Os erros já são gerenciados pelo context
    }

    // Verificar se campos devem ser readonly
    const isFromSubscription = !!pendingData || searchParams.has('asaasCustomerId');

    // Se dados expiraram, mostrar mensagem
    if (dataExpired) {
        return (
            <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
                <div className="w-full max-w-sm text-center">
                    <h1 className="text-2xl font-bold mb-4">Sessão Expirada</h1>
                    <p className="text-muted-foreground">
                        Os dados da sua assinatura expiraram. Redirecionando...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm ">
                {pendingData && (
                    <div className="mb-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            ✅ Pagamento Confirmado
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Complete seu cadastro para acessar a plataforma
                        </p>
                    </div>
                )}
                
                <SignupForm 
                    form={form} 
                    errors={errors} 
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    readonly={isFromSubscription}
                />
            </div>
        </main>
    );
}

