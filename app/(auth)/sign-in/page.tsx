"use client"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { signin } from "./actions"
import { useLoginForm } from "@/hooks/useForms"
import { SignInForm } from "@/components/forms/SignInForm"
import { loginFormData } from "@/lib/validations/validationForms"

export default function SignInPage() {
  const form = useLoginForm();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const searchParams = useSearchParams();
  const isFromSubscription = searchParams.get('from') === 'subscribe';

  async function onSubmit(data: loginFormData) {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
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

  // TODO: Implementar login social (Google) – função removida para evitar variável não usada

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm ">
        <SignInForm 
          form={form}
          errors={errors}
          onSubmit={onSubmit}
          fromSubscribe={isFromSubscription}
        />
      </div>
    </main>
  )
}
