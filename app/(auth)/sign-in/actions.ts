"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { loginFormSchema } from "@/lib/validations/validationForms";

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

  if (!supabase) {
    return {
      success: false,
      errors: { apiError: 'Serviço de autenticação indisponível' },
    }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      success: false,
      errors: {
        apiError: "Email ou senha inválidos",
      },
    };
  }

  return { success: true };
}