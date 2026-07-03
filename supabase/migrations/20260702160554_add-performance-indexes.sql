-- Índices de performance (auditoria 2026-07-02).
-- Espelham os @@index adicionados em prisma/schema.prisma (nomes na convenção Prisma).

-- TeamWhatsAppConfig: lookup do webhook Evolution por webhookSecret e por instanceName
CREATE INDEX IF NOT EXISTS "team_whatsapp_configs_webhookSecret_idx"
  ON "public"."team_whatsapp_configs" ("webhookSecret");

CREATE INDEX IF NOT EXISTS "team_whatsapp_configs_instanceName_idx"
  ON "public"."team_whatsapp_configs" ("instanceName");

-- WhatsAppMessage: joins/filtros por autor da mensagem
CREATE INDEX IF NOT EXISTS "whatsapp_messages_sentByProfileId_idx"
  ON "public"."whatsapp_messages" ("sentByProfileId");

-- WhatsAppConversation: listagem por time + arquivadas ordenada por última mensagem
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_teamId_isArchived_lastMessageAt_idx"
  ON "public"."whatsapp_conversations" ("teamId", "isArchived", "lastMessageAt" DESC);

CREATE INDEX IF NOT EXISTS "whatsapp_conversations_assignedProfileId_idx"
  ON "public"."whatsapp_conversations" ("assignedProfileId");

-- Lead: listagem do CRM por time + status ordenada por criação
CREATE INDEX IF NOT EXISTS "corretor_studio_leads_teamId_status_createdAt_idx"
  ON "public"."corretor_studio_leads" ("teamId", "status", "createdAt" DESC);

-- LeadActivity: timeline do lead ordenada por criação
CREATE INDEX IF NOT EXISTS "corretor_studio_lead_activities_leadId_createdAt_idx"
  ON "public"."corretor_studio_lead_activities" ("leadId", "createdAt" DESC);

-- Notification: listagem por destinatário + time ordenada por criação
-- (nome truncado para 63 chars pelo Postgres, igual ao que o Prisma geraria)
CREATE INDEX IF NOT EXISTS "corretor_studio_notifications_recipientProfileId_teamId_createdAt_idx"
  ON "public"."corretor_studio_notifications" ("recipientProfileId", "teamId", "createdAt" DESC);
