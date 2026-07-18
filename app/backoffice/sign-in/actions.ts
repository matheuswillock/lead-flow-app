"use server"

import { createSupabaseServer } from "@/lib/supabase/server"
import { loginFormSchema } from "@/lib/validations/validationForms"
import { redirect } from "next/navigation"
import { prisma } from "@/app/api/infra/data/prisma"
import { isBackofficeRole } from "@/lib/roles"
import { isValidBackofficeEmail } from "@/lib/backoffice/email-domain"

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

  if (!isValidBackofficeEmail(email)) {
    return {
      success: false,
      errors: {
        apiError: "Use um e-mail @corretorstudio.com.br do time interno.",
      },
    }
  }

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

  const sessionEmail = data.user.email ?? email
  if (!isValidBackofficeEmail(sessionEmail)) {
    await supabase.auth.signOut()
    return {
      success: false,
      errors: {
        apiError: "Use um e-mail @corretorstudio.com.br do time interno.",
      },
    }
  }

  const profile = await prisma.profile.findUnique({
    where: { supabaseId: data.user.id },
    select: {
      role: true,
      backofficeUser: { select: { isActive: true } },
    },
  })

  if (
    !profile ||
    !isBackofficeRole(profile.role) ||
    profile.backofficeUser?.isActive === false
  ) {
    await supabase.auth.signOut()
    return {
      success: false,
      errors: { apiError: "Acesso negado. Esta área é restrita ao time interno." },
    }
  }

  redirect("/backoffice")
}
