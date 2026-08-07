npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
═══════════════════════════════════════════════════
🔍 ANÁLISE: Leads Perdidos (form.started órfãos)
═══════════════════════════════════════════════════

📋 Buscando times...

✅ 2 times encontrados:
   • Avalanche de Vendas Unipessoal Ltda (aef1bfe7...) - meu@universo.top
   • MultiSkill (7b577c22...) - bruno@onsidemarketing.com.br

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Analisando: Avalanche de Vendas Unipessoal Ltda

   🔍 0 eventos form.started de email encontrados
   🔍 0 sem lead associado

   ✅ Nenhum lead perdido detectado!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Analisando: MultiSkill

   🔍 17 eventos form.started de email encontrados
   🔍 9 sem lead associado

   📋 Validando eventos...

❌ Erro na análise:
PrismaClientValidationError: 
Invalid `prisma.emailLog.findFirst()` invocation in
/home/matheuswillock/develop/lead-flow-app/scripts/analyze-lost-leads.ts:137:48

  134   reason = 'missing_recipient_email';
  135 } else {
  136   // Buscar EmailLog pelo recipientEmail e data próxima
→ 137   const emailLog = await prisma.emailLog.findFirst({
          where: {
            recipientEmail: "originallimp@originallimp.com.br",
            sentAt: {
              gte: new Date("2026-07-31T02:36:16.382Z"),
              lte: new Date("2026-08-07T02:36:16.382Z")
            }
          },
          include: {
            dispatch: {
              include: {
                emailCampaign: true,
                ~~~~~~~~~~~~~
        ?       campaign?: true,
        ?       team?: true,
        ?       template?: true,
        ?       contactList?: true,
        ?       triggerer?: true,
        ?       logs?: true
              }
            }
          },
          orderBy: {
            sentAt: "desc"
          }
        })

Unknown field `emailCampaign` for include statement on model `EmailCampaignDispatch`. Available options are marked with ?.
    at throwValidationException (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/core/errorRendering/throwValidationException.ts:45:9)
    at ei.handleRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:202:7)
    at ei.handleAndLogRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)
    at ei.request (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
    at async a (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
    at async main (/home/matheuswillock/develop/lead-flow-app/scripts/analyze-lost-leads.ts:137:26) {
  clientVersion: '6.19.3'
}
