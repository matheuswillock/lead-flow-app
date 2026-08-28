/**
 * Tags de cache consumidas por funcoes `"use cache"` e disparadas por
 * `lib/cache/invalidation.ts`.
 *
 * IMPORTANTE — este esquema depende do Data Cache gerenciado da Vercel, que e um
 * store global unico: `revalidateTag` de qualquer lambda invalida para todos.
 * Numa migracao futura para self-hosted (Coolify/Hostinger) isso muda:
 *
 * 1. O Next self-hosted usa cache por instancia (filesystem/LRU). Com mais de um
 *    container, `revalidateTag` no container A nao toca o B. Réplica unica nao e
 *    afetada — a quebra comeca na replica #2.
 * 2. O perfil `"max"` de `revalidateTag(tag, "max")` e interpretado pelo handler
 *    default. Um `cacheHandler` custom precisa implementar expiry de tag
 *    (`expireTags`/`receiveExpiredTags`) ou o segundo argumento vira no-op silencioso.
 * 3. `cacheLife("max")` (catalogo PME) vira "ate este container reiniciar", por container.
 * 4. `expire` deixa de ser rede de seguranca de frota: limita staleness por instancia,
 *    sem coordenacao entre replicas.
 * 5. `after()` dispara invalidacao pos-resposta, mas so alcanca a instancia local.
 * 6. O pin de regiao `gru1` (`vercel.json`) desaparece e o perfil de latencia
 *    Prisma→Supabase muda — o custo/beneficio de cada cache deve ser re-medido.
 *
 * A mitigacao, quando for o caso, e um cache handler compartilhado (Redis). Nada
 * aqui impede isso: toda funcao cacheada e uma `"use cache"` de escopo de modulo
 * com tags declaradas, que e o formato que um handler custom espera.
 */
export const cacheTags = {
  healthPlans: () => "health-plans",
  pmeSimulator: () => "pme-simulator",
  backofficeFeatures: () => "backoffice-features",
  featureAccessProfile: (profileId: string) => `feature-access-profile:${profileId}`,
  featureAccessOwner: (managerId: string) => `feature-access-owner:${managerId}`,
  accountAccessStatus: (accountMasterId: string) => `account-access-status:${accountMasterId}`,
  teamStatusRules: (teamId: string) => `team-status-rules:${teamId}`,
  leadStatusTransitionFieldRules: () => "lead-status-transition-field-rules",
  leadStatusTransitionGates: () => "lead-status-transition-gates",
  teamMembers: (teamId: string) => `team-members:${teamId}`,
  teamDashboard: (teamId: string) => `team-dashboard:${teamId}`,
  accountDashboard: (masterId: string) => `account-dashboard:${masterId}`,
  teamPerformance: (teamId: string) => `team-performance:${teamId}`,
  portfolio: (teamId: string) => `portfolio:${teamId}`,
  portfolioDetail: (leadId: string) => `portfolio-detail:${leadId}`,
  teamLeads: (teamId: string) => `team-leads:${teamId}`,
  lead: (leadId: string) => `lead:${leadId}`,
  leadDetails: (leadId: string) => `lead-details:${leadId}`,
  leadActivities: (leadId: string) => `lead-activities:${leadId}`,
  leadSchedules: (leadId: string) => `lead-schedules:${leadId}`,
  teamCalendar: (teamId: string) => `team-calendar:${teamId}`,
  teamTasks: (teamId: string) => `team-tasks:${teamId}`,
  publicFormBootstrap: (teamId: string) => `public-form-bootstrap:${teamId}`,
  teamFilterPresets: (teamId: string, profileId: string, scope: string) =>
    `team-filter-presets:${teamId}:${profileId}:${scope}`,
  notifications: (recipientProfileId: string) => `notifications:${recipientProfileId}`,
  radarSegments: (teamId: string) => `radar-segments:${teamId}`,
  /** Numeros institucionais da home. Sem escopo: valem para a conta inteira. */
  landingPublicStats: () => "landing-public-stats",
} as const;

