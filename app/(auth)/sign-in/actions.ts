"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { loginFormSchema } from "@/lib/validations/validationForms";
import { redirect } from "next/navigation";

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

  // Se o login foi bem-sucedido, redirecionar para o board com supabaseId
  if (data.user) {
    if (from === 'subscribe') {
      redirect('/subscribe');
    }
    redirect(`/${data.user.id}/board`);
  }
  redirect("/board");
}