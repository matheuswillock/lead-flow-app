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

❌ Erro na análise:
PrismaClientKnownRequestError: 
Invalid `prisma.$queryRaw()` invocation:


Raw query failed. Code: `42883`. Message: `ERROR: operator does not exist: uuid = text
HINT: No operator matches the given name and argument types. You might need to add explicit type casts.`
    at ei.handleRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:228:13)
    at ei.handleAndLogRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)
    at ei.request (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
    at async a (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
    at async main (/home/matheuswillock/develop/lead-flow-app/scripts/analyze-lost-leads.ts:71:26) {
  code: 'P2010',
  meta: {
    code: '42883',
    message: 'ERROR: operator does not exist: uuid = text\n' +
      'HINT: No operator matches the given name and argument types. You might need to add explicit type casts.'
  },
  clientVersion: '6.19.3'
}
