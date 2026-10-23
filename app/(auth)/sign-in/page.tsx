"use client"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { signin } from "./actions"
import { useLoginForm } from "@/hooks/useForms"
import { SignInForm } from "@/components/forms/SignInForm"
import { loginFormData } from "@/lib/validations/validationForms"
import { PageLoading } from "@/components/global-loading"
import { toast } from "sonner"

function isNextRedirectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as Error & { digest?: unknown }).digest;
  return error.message === "NEXT_REDIRECT" || (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"));
}

function SignInInner() {
  const form = useLoginForm();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isRedirecting, setIsRedirecting] = useState(false);
  const searchParams = useSearchParams();
  const emailPrefill = searchParams.get('email') ?? '';

  useEffect(() => {
    if (!emailPrefill) return;
    form.setValue('email', emailPrefill);
    form.setValue('password', '');
    form.clearErrors('email');
  }, [emailPrefill, form]);

  async function onSubmit(data: loginFormData) {
    if (isRedirecting) return;

    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    const returnPath = searchParams.get("next");
    if (returnPath) formData.append("next", returnPath);

    // O redirect() do server action chega aqui como exceção NEXT_REDIRECT
    // antes de a navegação terminar; o botão fica bloqueado até a troca de rota.
    setIsRedirecting(true);
    let result: Awaited<ReturnType<typeof signin>> | undefined;
    try {
      result = await signin(formData);
    } catch (error) {
      if (!isNextRedirectError(error)) setIsRedirecting(false);
      throw error;
    }

    if (result?.success === false) {
      setIsRedirecting(false);
      const fe: Record<string, string> = {};
      Object.entries(result.errors || {}).forEach(([k, v]) => {
        fe[k] = Array.isArray(v) ? v.join(", ") : String(v);
      });
      setErrors(fe);
      
      // Exibir erro amigável no toast
      if ('apiError' in (result.errors || {})) {
        const apiError = (result.errors as { apiError: string }).apiError;
        toast.error(apiError);
      } else {
        toast.error('Verifique os campos do formulário');
      }
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        <SignInForm 
          form={form}
          errors={errors}
          isRedirecting={isRedirecting}
          onSubmit={onSubmit}
        />
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SignInInner />
    </Suspense>
  );
}
