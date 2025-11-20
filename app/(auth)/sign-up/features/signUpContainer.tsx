"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSignUpForm } from "@/hooks/useForms";
import { SignupForm } from "@/components/forms/signUpForm";
import { useSignUp } from "./signUpContext";
import { signUpFormData } from "@/lib/validations/validationForms";
import { toast } from "sonner";

/**
 * Componente interno que usa o context
 * Separado para poder usar o hook useSignUp
 */
export function SignUpFormContainer() {
    const searchParams = useSearchParams();
    const form = useSignUpForm();
    const { isLoading, errors, registerUser } = useSignUp();

    // Auth-first: no pendingSignUp/session flow; no URL fallback prefill.
    useEffect(() => { /* noop */ }, [searchParams, form]);

    async function onSubmit(data: signUpFormData) {
        console.info('🚀 [SignUpFormContainer] onSubmit iniciado');

        const result = await registerUser(data);

        if (result.isValid && result.result?.supabaseId) {
            // Novo fluxo: criar checkout Asaas e redirecionar
            toast.success('Cadastro concluído', {
                description: 'Criando sua assinatura...',
                duration: 3000,
            });

            try {
                // Chamar API para criar checkout
                const checkoutResponse = await fetch('/api/v1/checkout/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        supabaseId: result.result.supabaseId,
                        fullName: data.fullName,
                        email: data.email,
                        phone: data.phone,
                        cpfCnpj: data.cpfCnpj,
                    }),
                });

                const checkoutResult = await checkoutResponse.json();

                if (checkoutResult.isValid && checkoutResult.result?.checkoutUrl) {
                    toast.success('Redirecionando para pagamento', {
                        description: 'Você será redirecionado para finalizar sua assinatura.',
                        duration: 2000,
                    });

                    // Aguardar toast aparecer
                    setTimeout(() => {
                        // Redirecionar para checkout Asaas
                        window.location.href = checkoutResult.result.checkoutUrl;
                    }, 1500);
                } else {
                    toast.error('Erro ao criar checkout', {
                        description: checkoutResult.errorMessages?.join(', ') || 'Tente novamente.',
                        duration: 5000,
                    });
                }
            } catch (error) {
                console.error('❌ [SignUpFormContainer] Erro ao criar checkout:', error);
                toast.error('Erro ao processar assinatura', {
                    description: 'Entre em contato com o suporte.',
                    duration: 5000,
                });
            }
        }
        // Os erros já são gerenciados pelo context
    }

    // Verificar se veio do fluxo de assinatura (apenas para copy/UX)
    // REMOVIDO: Agora todos os cadastros vão para /subscribe, então não precisa de lógica condicional

    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm ">
                <SignupForm 
                    form={form} 
                    errors={errors} 
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    readonly={false}
                />
            </div>
        </main>
    );
}

