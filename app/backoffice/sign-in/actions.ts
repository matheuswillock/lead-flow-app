"use server"

import { createSupabaseServer } from "@/lib/supabase/server"
import { loginFormSchema } from "@/lib/validations/validationForms"
import { redirect } from "next/navigation"
import { prisma } from "@/app/api/infra/data/prisma"
import { isBackofficeRole } from "@/lib/roles"

export async function backofficeSignin(formData: FormData) {
  const parseData = Object.fromEntries(formData.entries())
  const validationFields = loginFormSchema.safeParse(parseData)

  if (!validationFields.success) {
    return {
      success: false,
      errors: validationFields.error.flatten().fieldErrors,
    }
  }

  const { email, password } = validationFields.data

  const supabase = await createSupabaseServer()
  if (!supabase) {
    return {
      success: false,
      errors: { apiError: "Serviço de autenticação indisponível" },
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return {
      success: false,
      errors: { apiError: "E-mail ou senha inválidos" },
    }
  }

  // Verificar se o usuário tem role backoffice
  const profile = await prisma.profile.findUnique({
    where: { supabaseId: data.user.id },
    select: { role: true },
  })

  if (!profile || !isBackofficeRole(profile.role)) {
    // Fazer logout para não deixar sessão ativa de usuário não autorizado
    await supabase.auth.signOut()
    return {
      success: false,
      errors: { apiError: "Acesso negado. Esta área é restrita ao time interno." },
    }
  }

  redirect("/backoffice")
}
