"use client"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { signin } from "./actions"
import { useLoginForm } from "@/hooks/useForms"
import { SignInForm } from "@/components/forms/SignInForm"
import { loginFormData } from "@/lib/validations/validationForms"
import { PageLoading } from "@/components/global-loading"
import { toast } from "sonner"

function SignInInner() {
  const form = useLoginForm();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const searchParams = useSearchParams();
  const isFromSubscription = searchParams.get('from') === 'subscribe';
  const isFromCheckout = searchParams.get('from') === 'checkout';
  const paymentSuccess = searchParams.get('success') === 'true';
  const emailPrefill = searchParams.get('email') ?? '';

  // Exibir toast de sucesso do pagamento
  useEffect(() => {
    if (isFromCheckout && paymentSuccess) {
      toast.success('Pagamento realizado com sucesso!', {
        description: 'Faça login para acessar sua conta.',
        duration: 5000,
      });
    }
  }, [isFromCheckout, paymentSuccess]);

  useEffect(() => {
    if (!emailPrefill) return;
    form.setValue('email', emailPrefill);
    form.setValue('password', '');
    form.clearErrors('email');
  }, [emailPrefill, form]);

  async function onSubmit(data: loginFormData) {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    
    // Preservar origem (checkout ou subscribe)
    const from = searchParams.get('from');
    if (from) formData.append('from', from);

    const result = await signin(formData);
    if (!result.success) {
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
