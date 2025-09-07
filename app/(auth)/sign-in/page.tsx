"use client"
import { useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { LoginForm } from "@/components/loginForm"
import { signin } from "./actions"
import { useLoginForm } from "@/hooks/useForms"
import { loginFormData } from "@/lib/types/formTypes"

export default function SignInPage() {
  const form = useLoginForm();
  const supabase = createSupabaseBrowser()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
      console.log(result.errors);
      const fe: Record<string, string> = {};
      Object.entries(result.errors || {}).forEach(([k, v]) => {
        fe[k] = Array.isArray(v) ? v.join(", ") : String(v);
      });
      setErrors(fe);
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/dashboard` } })
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm ">
        <LoginForm 
          form={form}
          errors={errors}
          setErrors={setErrors}
          onSubmit={onSubmit} 
        />
      </div>
    </main>
  )
}
