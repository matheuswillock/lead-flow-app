"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignUpForm } from "@/hooks/useForms";
import { SignupForm } from "@/components/forms/signUpForm";
import { CheckoutStep } from "./CheckoutStep";
import { useSignUp } from "./signUpContext";
import { signUpFormData } from "@/lib/validations/validationForms";
import { toast } from "sonner";

/**
 * Componente interno que usa o context
 * Separado para poder usar o hook useSignUp
 */
export function SignUpFormContainer() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const form = useSignUpForm();
    const { 
        isLoading, 
        errors, 
        currentStep, 
        registerUser,
        goBackToForm,
    } = useSignUp();
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const deleteUserRef = useRef<string | null>(null);

    // Detectar parâmetro deleteUser (vindo do checkout cancelado/expirado)
    useEffect(() => {
        const deleteUserId = searchParams.get('deleteUser');
        
        if (deleteUserId && !isDeletingUser && deleteUserRef.current !== deleteUserId) {
            deleteUserRef.current = deleteUserId;
            goBackToForm();
            setIsDeletingUser(true);
            
            // Deletar usuário
            (async () => {
                try {
                    console.info('🗑️ [SignUpFormContainer] Deletando usuário abandonado:', deleteUserId);
                    
                    toast.info('Cancelando pagamento', {
                        description: 'Voltando ao cadastro e removendo a conta criada...',
                        duration: 3000,
                    });

                    toast.info('Checkout cancelado', {
                        description: 'Removendo conta criada...',
                        duration: 3000,
                    });

                    const response = await fetch(`/api/v1/users/delete?supabaseId=${deleteUserId}`, {
                        method: 'DELETE',
                    });

                    const result = await response.json();

                    if (result.isValid) {
                        console.info('✅ [SignUpFormContainer] Usuário deletado com sucesso');
                        
                        toast.success('Checkout cancelado', {
                            description: 'Sua conta foi removida. Você pode tentar novamente quando quiser.',
                            duration: 5000,
                        });
                    } else {
                        console.error('❌ [SignUpFormContainer] Erro ao deletar usuário:', result.errorMessages);
                        
                        toast.error('Erro ao remover conta', {
                            description: 'Entre em contato com o suporte.',
                            duration: 5000,
                        });
                    }
                } catch (error) {
                    console.error('❌ [SignUpFormContainer] Erro ao deletar usuário:', error);
                    
                    toast.error('Erro ao processar cancelamento', {
                        description: 'Entre em contato com o suporte.',
                        duration: 5000,
                    });
                } finally {
                    setIsDeletingUser(false);
                    
                    // Limpar parâmetro da URL
                    router.replace('/sign-up');
                }
            })();
        }
    }, [searchParams, isDeletingUser, router]);

    async function onSubmit(data: signUpFormData) {
        console.info('🚀 [SignUpFormContainer] onSubmit iniciado');
        console.info('📦 [SignUpFormContainer] Dados do formulário:', {
            neighborhood: data.neighborhood,
            postalCode: data.postalCode,
            address: data.address,
            addressNumber: data.addressNumber,
            complement: data.complement,
            city: data.city,
            state: data.state,
        });

        const result = await registerUser(data);

        if (result.isValid) {
            // Conta criada com sucesso - agora mostrar seleção de pagamento
            toast.success('Cadastro concluído', {
                description: 'Agora escolha a forma de pagamento',
                duration: 3000,
            });
        }
        // Os erros já são gerenciados pelo context
    }

    // Verificar se veio do fluxo de assinatura (apenas para copy/UX)
    // REMOVIDO: Agora todos os cadastros vão para /subscribe, então não precisa de lógica condicional

    // Renderizar etapa apropriada
    if (currentStep === 'payment') {
        return <CheckoutStep onBack={goBackToForm} />;
    }

    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm ">
                <SignupForm 
                    form={form} 
                    errors={errors} 
                    onSubmit={onSubmit}
                    isLoading={isLoading || isDeletingUser}
                    readonly={isDeletingUser}
                />
            </div>
        </main>
    );
}

