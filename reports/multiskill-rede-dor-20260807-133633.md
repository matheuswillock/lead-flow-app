npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
═══════════════════════════════════════════════════
🔍 INVESTIGAÇÃO: Campanhas Rede Dor (Multiskill)
═══════════════════════════════════════════════════

📋 Buscando time Multiskill...

❌ Erro na investigação:
PrismaClientInitializationError: 
Invalid `prisma.team.findFirst()` invocation in
/home/matheuswillock/develop/lead-flow-app/scripts/investigate-multiskill-rede-dor.ts:36:44

  33 // 1. Buscar time Multiskill
  34 console.log('📋 Buscando time Multiskill...\n');
  35 
→ 36 const multiskillTeam = await prisma.team.findFirst(
Can't reach database server at `aws-1-sa-east-1.pooler.supabase.com:6543`

Please make sure your database server is running at `aws-1-sa-east-1.pooler.supabase.com:6543`.
    at ei.handleRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)
    at ei.handleAndLogRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)
    at ei.request (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
    at async a (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
    at async main (/home/matheuswillock/develop/lead-flow-app/scripts/investigate-multiskill-rede-dor.ts:36:26) {
  clientVersion: '6.19.3',
  errorCode: undefined,
  retryable: undefined
}
