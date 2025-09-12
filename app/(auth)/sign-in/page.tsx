"use client"
import { useState } from "react"
import { signin } from "./actions"
import { useLoginForm } from "@/hooks/useForms"
import { loginFormData } from "@/lib/types/formTypes"
import { LoginForm } from "@/components/forms/loginForm"

export default function SignInPage() {
  const form = useLoginForm();
  // const supabase = createSupabaseBrowser() // (removido enquanto login social não é usado)
  // Estados removidos (email/password) pois o formulário usa react-hook-form
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(data: loginFormData) {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);

    const result = await signin(formData);
    if (result.success) {
      window.location.href = "/dashboard";
    } else {
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
        <LoginForm 
          form={form}
          errors={errors}
          onSubmit={onSubmit} 
        />
      </div>
    </main>
  )
}
