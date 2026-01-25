"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignUpForm } from "@/hooks/useForms";
import { SignupForm } from "@/components/forms/signUpForm";
import { CheckoutStep } from "./CheckoutStep";
import { useSignUp } from "./signUpContext";
import { signUpFormData, signUpOAuthFormData } from "@/lib/validations/validationForms";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

/**
 * Componente interno que usa o context
 * Separado para poder usar o hook useSignUp
 */
export function SignUpFormContainer() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const isOAuth = searchParams.get("oauth") === "google";
    const isNewUser = searchParams.get("newUser") === "1";
    const form = useSignUpForm(isOAuth ? "oauth" : "default");
    const { 
        isLoading, 
        errors, 
        currentStep, 
        registerUser,
        goBackToForm,
    } = useSignUp();
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const deleteUserRef = useRef<string | null>(null);
    const oauthInitRef = useRef(false);
    const newUserToastRef = useRef(false);

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

    useEffect(() => {
        if (!isNewUser || newUserToastRef.current) {
            return;
        }

        newUserToastRef.current = true;
        toast.info("Primeiro acesso com Google", {
            description: "Finalize seu cadastro e siga para a assinatura.",
            duration: 5000,
        });
    }, [isNewUser]);

    useEffect(() => {
        if (!isOAuth || oauthInitRef.current) {
            return;
        }

        oauthInitRef.current = true;
        const stored = sessionStorage.getItem("oauthSignup");
        if (stored) {
            try {
                const data = JSON.parse(stored) as { fullName?: string; email?: string; phone?: string };
                if (data.fullName) form.setValue("fullName", data.fullName);
                if (data.email) form.setValue("email", data.email);
                if (data.phone) form.setValue("phone", data.phone);
                return;
            } catch (error) {
                console.warn("Falha ao ler dados do cadastro Google:", error);
            }
        }

        const supabase = createSupabaseBrowser();
        if (!supabase) return;

        supabase.auth.getSession().then(({ data }) => {
            const user = data.session?.user;
            if (!user) return;
            const metadata = user.user_metadata as { full_name?: string; name?: string } | undefined;
            const fullName = metadata?.full_name || metadata?.name;
            if (fullName) form.setValue("fullName", fullName);
            if (user.email) form.setValue("email", user.email);
        });
    }, [form, isOAuth]);

    async function onSubmit(data: signUpFormData | signUpOAuthFormData) {
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

        const result = await registerUser(data, { isOAuth });

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
                    isOAuth={isOAuth}
                />
            </div>
        </main>
    );
}

