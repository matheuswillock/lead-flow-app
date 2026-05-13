export const FEATURE_SLUGS = {
  CRM: "crm",
  CRM_DASHBOARD: "crm-dashboard",
  CRM_CRM: "crm-crm",
  CRM_CALENDAR: "crm-calendar",
  CRM_PERFORMANCE: "crm-performance",
  CRM_SIMULATOR: "crm-simulator",
  CRM_TIME: "crm-time",
  CRM_TIME_MANAGE_TEAMS: "crm-time-manage-teams",
  CRM_TIME_MANAGE_USERS: "crm-time-manage-users",
  EMAIL: "email",
} as const

export type FeatureSlug = (typeof FEATURE_SLUGS)[keyof typeof FEATURE_SLUGS]
