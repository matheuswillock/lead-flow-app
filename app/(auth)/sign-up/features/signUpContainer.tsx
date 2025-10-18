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
            const from = searchParams.get('from');
            if (from === 'subscribe') {
                toast.success('Cadastro concluído', {
                    description: 'Agora escolha o plano e finalize sua assinatura.',
                    duration: 5000,
                });
                // Handoff: enviar dados básicos para a tela de assinatura
                try {
                    const prefill = {
                        fullName: data.fullName,
                        email: data.email,
                        phone: data.phone,
                    };
                    sessionStorage.setItem('subscribePrefill', JSON.stringify(prefill));
                } catch (_) {/* ignore */}
                setTimeout(() => {
                    window.location.href = `/subscribe`;
                }, 900);
            } else {
                toast.success('Cadastro concluído', {
                    description: 'Redirecionando para sua área de trabalho...',
                    duration: 5000,
                });
                setTimeout(() => {
                    window.location.href = `/${result.result.supabaseId}/board`;
                }, 900);
            }
        }
        // Os erros já são gerenciados pelo context
    }

    // Verificar se veio do fluxo de assinatura (apenas para copy/UX)
    const isFromSubscription = searchParams.get('from') === 'subscribe';

    // Se dados expiraram, mostrar mensagem
    // No expiration state in auth-first only flow

    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm ">
                <SignupForm 
                    form={form} 
                    errors={errors} 
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    // Não desabilitar campos no fluxo auth-first
                    readonly={false}
                    fromSubscribe={isFromSubscription}
                />
            </div>
        </main>
    );
}

