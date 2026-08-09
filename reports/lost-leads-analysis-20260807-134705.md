npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
═══════════════════════════════════════════════════
🔍 ANÁLISE: Leads Perdidos (form.started órfãos)
═══════════════════════════════════════════════════

📋 Buscando times...

❌ Erro na análise:
PrismaClientInitializationError: 
Invalid `prisma.team.findMany()` invocation in
/home/matheuswillock/develop/lead-flow-app/scripts/analyze-lost-leads.ts:42:35

  39 // 1. Buscar os 3 times principais
  40 console.log('📋 Buscando times...\n');
  41 
→ 42 const teams = await prisma.team.findMany(
Can't reach database server at `aws-1-sa-east-1.pooler.supabase.com:6543`

Please make sure your database server is running at `aws-1-sa-east-1.pooler.supabase.com:6543`.
    at ei.handleRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)
    at ei.handleAndLogRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)
    at ei.request (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
    at async a (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
    at async main (/home/matheuswillock/develop/lead-flow-app/scripts/analyze-lost-leads.ts:42:17) {
  clientVersion: '6.19.3',
  errorCode: undefined,
  retryable: undefined
}
