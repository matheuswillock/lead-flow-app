"use client";
import { useSignUpForm } from "@/hooks/useForms";
import { signUpFormData } from "@/lib/types/formTypes";
import { SignupForm } from "@/components/forms/signUpForm";
import { useSignUp } from "./signUpContext";

/**
 * Componente interno que usa o context
 * Separado para poder usar o hook useSignUp
 */
export function SignUpFormContainer() {
    const form = useSignUpForm();
    const { isLoading, errors, registerUser } = useSignUp();

    async function onSubmit(data: signUpFormData) {
        const result = await registerUser(data);

        if (result.isValid) {
            // Sucesso - redirecionar para sign-in
            window.location.href = "/sign-in";
        }
        // Os erros já são gerenciados pelo context
    }

    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm ">
                <SignupForm 
                    form={form} 
                    errors={errors} 
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                />
            </div>
        </main>
    );
}
