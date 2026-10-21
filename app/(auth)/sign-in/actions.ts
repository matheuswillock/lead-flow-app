"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { loginFormSchema } from "@/lib/validations/validationForms";
import { redirect } from "next/navigation";
import { resolveSafeReturnPath } from "@/lib/auth/safe-return-path";

export async function signin(formData: FormData) {
  const supabase = await createSupabaseServer();

  const parseData = Object.fromEntries(formData.entries());

  const validationFields = loginFormSchema.safeParse(parseData);

  if (!validationFields.success) {
    return {
      success: false,
      errors: validationFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validationFields.data;
  const from = (formData.get('from') as string) || undefined;

  if (!supabase) {
    return {
      success: false,
      errors: { apiError: 'Serviço de autenticação indisponível' },
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      success: false,
      errors: {
        apiError: "Email ou senha inválidos",
      },
    };
  }

  // Se o login foi bem-sucedido, redirecionar
  if (data.user) {
    const returnPath = resolveSafeReturnPath(formData.get('next') as string | null);
    if (returnPath) {
      redirect(returnPath);
    }

    // Redirect de subscription ou checkout
    if (from === 'checkout') {
      redirect(`/${data.user.id}/dashboard`);
    }
    
    // Redirect padrão
    redirect(`/${data.user.id}/crm`);
  }
  redirect("/crm");
}
