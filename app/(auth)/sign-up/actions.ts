"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { signupFormSchema } from "@/lib/validations/validationForms";
import prisma from "@/app/api/infra/data/prisma";

export async function signup(formData: FormData) {
  const supabase = await createSupabaseServer();

  const parseData = Object.fromEntries(formData.entries());
  const validation = signupFormSchema.safeParse(parseData);
  if (!validation.success) {
    return { success: false, errors: validation.error.flatten().fieldErrors };
  }

  if (!supabase) {
    return { success: false, errors: { apiError: "Serviço de autenticação indisponível" } };
  }

  const { email, password, fullName, phone } = validation.data;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) {
    return { success: false, errors: { apiError: signUpError.message } };
  }

  const user = signUpData.user;
  if (!user) {
    return { success: false, errors: { apiError: "Falha ao criar usuário" } };
  }

  // Criar perfil como manager
  try {
    await prisma.profile.create({
      data: {
        id: user.id,
        supabaseId: user.id,
        fullName,
        phone,
        role: "manager",
      },
    });
  } catch {
    return { success: false, errors: { apiError: "Falha ao criar perfil" } };
  }

  return { success: true };
}
