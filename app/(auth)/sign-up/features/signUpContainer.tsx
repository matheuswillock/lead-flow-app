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
            // Novo fluxo: sempre redirecionar para página de assinatura
            toast.success('Cadastro concluído', {
                description: 'Agora escolha seu plano e finalize sua assinatura.',
                duration: 5000,
            });
            
            // Armazenar dados para prefill na página de assinatura
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

