npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
═══════════════════════════════════════════════════
🔍 AUDITORIA: Eventos Radar (3 Times)
═══════════════════════════════════════════════════

📋 Buscando times...

❌ Erro na auditoria:
PrismaClientInitializationError: 
Invalid `prisma.team.findMany()` invocation in
/home/matheuswillock/develop/lead-flow-app/scripts/audit-radar-events.ts:25:35

  22 // 1. Buscar os 3 times
  23 console.log('📋 Buscando times...\n');
  24 
→ 25 const teams = await prisma.team.findMany(
Can't reach database server at `aws-1-sa-east-1.pooler.supabase.com:6543`

Please make sure your database server is running at `aws-1-sa-east-1.pooler.supabase.com:6543`.
    at ei.handleRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)
    at ei.handleAndLogRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)
    at ei.request (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
    at async a (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
    at async main (/home/matheuswillock/develop/lead-flow-app/scripts/audit-radar-events.ts:25:17) {
  clientVersion: '6.19.3',
  errorCode: undefined,
  retryable: undefined
}
