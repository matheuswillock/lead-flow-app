npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
═══════════════════════════════════════════════════
🔍 ANÁLISE: Leads Perdidos (form.started órfãos)
═══════════════════════════════════════════════════

📋 Buscando times...

❌ Erro na análise:
PrismaClientValidationError: 
Invalid `prisma.team.findMany()` invocation in
/home/matheuswillock/develop/lead-flow-app/scripts/analyze-lost-leads.ts:42:35

  39 // 1. Buscar os 3 times principais
  40 console.log('📋 Buscando times...\n');
  41 
→ 42 const teams = await prisma.team.findMany({
       where: {
         OR: [
           {
             name: {
               contains: "Multiskill",
               mode: "insensitive"
             }
           },
           {
             name: {
               contains: "Katherein",
               mode: "insensitive"
             }
           },
           {
             name: {
               contains: "Avalanche",
               mode: "insensitive"
             }
           }
         ]
       },
       include: {
         ownerProfile: {
         ~~~~~~~~~~~~
           select: {
             email: true
           }
         },
     ?   master?: true,
     ?   deletedBy?: true,
     ?   members?: true,
     ?   leads?: true,
     ?   pendingOperators?: true,
     ?   pendingActions?: true,
     ?   notifications?: true,
     ?   studioWebhookConfig?: true,
     ?   studioWebhookRequestLogs?: true,
     ?   radarPixelConfig?: true,
     ?   radarPixelHitLogs?: true,
     ?   teamWebhooks?: true,
     ?   teamWebhookEventLogs?: true,
     ?   teamWebhookOutbox?: true,
     ?   filterPresets?: true,
     ?   statusRules?: true,
     ?   automationRules?: true,
     ?   automationRunLogs?: true,
     ?   leadCustomFieldDefinitions?: true,
     ?   publicForms?: true,
     ?   publicFormSettings?: true,
     ?   publicFormTemplates?: true,
     ?   transferRoutesFrom?: true,
     ?   transferRoutesTo?: true,
     ?   outboundLeadTransfers?: true,
     ?   inboundLeadTransfers?: true,
     ?   portfolioEntries?: true,
     ?   emailTemplates?: true,
     ?   emailContactLists?: true,
     ?   emailImportJobs?: true,
     ?   emailCampaigns?: true,
     ?   emailCampaignDispatches?: true,
     ?   emailLogs?: true,
     ?   emailSettings?: true,
     ?   emailDomainEvents?: true,
     ?   emailSenders?: true,
     ?   emailVariables?: true,
     ?   emailTemplateHistory?: true,
     ?   emailCreditSubscription?: true,
     ?   whatsappConfig?: true,
     ?   whatsappConversations?: true,
     ?   whatsappMessages?: true,
     ?   whatsappUsageEvents?: true,
     ?   whatsappContacts?: true,
     ?   whatsappContactIdentities?: true,
     ?   whatsappConversationTags?: true,
     ?   whatsappOutboundCommands?: true,
     ?   whatsappMessageReactions?: true,
     ?   whatsappMessageFavorites?: true,
     ?   whatsappMessagePins?: true,
     ?   whatsappMessageVisibility?: true,
     ?   whatsappMessageActionCommands?: true,
     ?   whatsappWebhookEvents?: true,
     ?   whatsappSyncJobs?: true,
     ?   whatsappAuditEvents?: true,
     ?   whatsappSendRateLimitWindows?: true,
     ?   radarProfiles?: true,
     ?   radarIdentities?: true,
     ?   radarSourceLinks?: true,
     ?   radarEvents?: true,
     ?   radarChannelConsents?: true,
     ?   radarSegments?: true,
     ?   radarFieldDefinitions?: true,
     ?   radarImportJobs?: true,
     ?   backofficeBotSessions?: true,
     ?   backofficeFeatureGrantTeams?: true,
     ?   operationalAccessGrants?: true,
     ?   teamEmailLimitGrant?: true,
     ?   emailCampaignLimitGrant?: true,
     ?   meetingFollowUpDigestLogs?: true,
     ?   leadTags?: true
       }
     })

Unknown field `ownerProfile` for include statement on model `Team`. Available options are marked with ?.
    at throwValidationException (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/core/errorRendering/throwValidationException.ts:45:9)
    at ei.handleRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:202:7)
    at ei.handleAndLogRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)
    at ei.request (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
    at async a (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
    at async main (/home/matheuswillock/develop/lead-flow-app/scripts/analyze-lost-leads.ts:42:17) {
  clientVersion: '6.19.3'
}
