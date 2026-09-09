/**
 * Plano do backfill de merge dos perfis Radar duplicados por e-mail (bug
 * 2026-09-03, caso PIMENTAS/KKJ — 3.163 pares medidos em produção).
 *
 * A lógica vive separada do script para ser testável sem Prisma: a decisão
 * delicada é reconhecer o padrão exato do bug (par com telefone/sem
 * telefone) e recusar qualquer grupo que fuja dele — nunca funde no escuro.
 * A escrita em si (o merge propriamente dito) NÃO vive aqui: o script chama
 * `radarRepository.mergeProfiles`, a mesma rotina de produção usada por
 * `MergeLeadsUseCase`/E3b, nunca reimplementada.
 */

export type DuplicateEmailProfile = {
  id: string
  normalizedPhone: string | null
  createdAt: Date
}

export type DuplicateEmailGroup = {
  teamId: string
  normalizedPrimaryEmail: string
  normalizedName: string
  profiles: DuplicateEmailProfile[]
}

export type MergePlanItem = {
  teamId: string
  normalizedPrimaryEmail: string
  normalizedName: string
  winningProfileId: string
  losingProfileId: string
}

export type MergeSkipReason = "nao_e_par" | "nenhum_tem_telefone" | "ambos_tem_telefone"

export type MergeSkip = {
  teamId: string
  normalizedPrimaryEmail: string
  normalizedName: string
  reason: MergeSkipReason
  profileCount: number
}

export type MergePlan = {
  items: MergePlanItem[]
  skipped: MergeSkip[]
}

/**
 * Seleção segura: EXATAMENTE 2 perfis no grupo (mesmo time + mesmo e-mail +
 * mesmo nome normalizado), um com telefone e um sem — o padrão exato medido
 * em produção (import cria o perfil com telefone, sync de e-mail cria o
 * segundo sem telefone). Qualquer outra forma foge do padrão comprovadamente
 * seguro e é pulada, nunca fundida por suposição.
 */
export function planDuplicateEmailProfileMerges(groups: DuplicateEmailGroup[]): MergePlan {
  const items: MergePlanItem[] = []
  const skipped: MergeSkip[] = []

  for (const group of groups) {
    const base = {
      teamId: group.teamId,
      normalizedPrimaryEmail: group.normalizedPrimaryEmail,
      normalizedName: group.normalizedName,
    }

    if (group.profiles.length !== 2) {
      skipped.push({ ...base, reason: "nao_e_par", profileCount: group.profiles.length })
      continue
    }

    const withPhone = group.profiles.filter((profile) => Boolean(profile.normalizedPhone))

    if (withPhone.length === 0) {
      skipped.push({ ...base, reason: "nenhum_tem_telefone", profileCount: 2 })
      continue
    }

    if (withPhone.length === 2) {
      skipped.push({ ...base, reason: "ambos_tem_telefone", profileCount: 2 })
      continue
    }

    const winner = withPhone[0]
    const loser = group.profiles.find((profile) => profile.id !== winner.id)

    // Estruturalmente sempre encontrado (grupo tem exatamente 2 perfis e
    // `winner` é um deles) — guarda só para satisfazer o tipo.
    if (!loser) {
      skipped.push({ ...base, reason: "nao_e_par", profileCount: group.profiles.length })
      continue
    }

    items.push({ ...base, winningProfileId: winner.id, losingProfileId: loser.id })
  }

  return { items, skipped }
}
