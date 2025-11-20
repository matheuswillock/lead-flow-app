"use client"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { signin } from "./actions"
import { useLoginForm } from "@/hooks/useForms"
import { SignInForm } from "@/components/forms/SignInForm"
import { loginFormData } from "@/lib/validations/validationForms"
import { PageLoading } from "@/components/global-loading";

function SignInInner() {
  const form = useLoginForm();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const searchParams = useSearchParams();
  const isFromSubscription = searchParams.get('from') === 'subscribe';
  const isFromCheckout = searchParams.get('from') === 'checkout';
  const paymentSuccess = searchParams.get('success') === 'true';

  async function onSubmit(data: loginFormData) {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    
    // Preservar origem (checkout ou subscribe)
    const from = searchParams.get('from');
    if (from) formData.append('from', from);

    const result = await signin(formData);
    if (!result.success) {
      // TODO: Mapear erros para string simples
      console.error(result.errors);
      const fe: Record<string, string> = {};
      Object.entries(result.errors || {}).forEach(([k, v]) => {
        fe[k] = Array.isArray(v) ? v.join(", ") : String(v);
      });
      setErrors(fe);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        {isFromCheckout && paymentSuccess && (
          <div className="rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-950/20 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="space-y-1">
                <p className="font-semibold text-green-900 dark:text-green-200">
                  Pagamento realizado com sucesso!
                </p>
                <p className="text-sm text-green-800 dark:text-green-300">
                  Faça login para acessar sua conta.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <SignInForm 
          form={form}
          errors={errors}
          onSubmit={onSubmit}
          fromSubscribe={isFromSubscription}
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
