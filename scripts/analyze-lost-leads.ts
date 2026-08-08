#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Script de Análise: Leads Perdidos
 * 
 * Objetivo: Identificar eventos form.started que deveriam ter criado leads mas não criaram
 * 
 * Regra de negócio:
 * - form.started com emailLogId DEVE criar lead
 * - Fase E já corrigiu o bug de form.viewed criar leads fantasmas
 * - Este script identifica casos perdidos antes/durante a Fase E
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LostLeadCandidate {
  eventId: string;
  profileId: string;
  emailLogId: string;
  occurredAt: Date;
  email: string | null;
  phone: string | null;
  name: string | null;
  teamId: string;
  teamName: string;
  campaignId: string | null;
  campaignName: string | null;
  reason: string;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 ANÁLISE: Leads Perdidos (form.started órfãos)');
  console.log('═══════════════════════════════════════════════════\n');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Buscar os 3 times principais
  console.log('📋 Buscando times...\n');

  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { name: { contains: 'Multiskill', mode: 'insensitive' } },
        { name: { contains: 'Katherein', mode: 'insensitive' } },
        { name: { contains: 'Avalanche', mode: 'insensitive' } },
      ],
    },
    include: {
      master: {
        select: { email: true },
      },
    },
  });

  console.log(`✅ ${teams.length} times encontrados:`);
  teams.forEach((team) => {
    console.log(`   • ${team.name} (${team.id.substring(0, 8)}...) - ${team.master.email}`);
  });
  console.log('');

  const lostLeadCandidates: LostLeadCandidate[] = [];

  // 2. Para cada time, buscar eventos form.started órfãos
  for (const team of teams) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Analisando: ${team.name}\n`);

    // 2.1 Buscar eventos form.started com recipientEmail (vieram de campanha) mas sem lead
    const orphanEvents = await prisma.$queryRaw<
      Array<{
        eventId: string;
        profileId: string;
        occurredAt: Date;
        recipientEmail: string | null;
        normalizedEmail: string | null;
        normalizedPhone: string | null;
        name: string | null;
        metadata: any;
      }>
    >`
      SELECT 
        re.id as "eventId",
        re."profileId",
        re."occurredAt",
        re.metadata->'origin'->>'recipientEmail' as "recipientEmail",
        rp."normalizedPrimaryEmail" as "normalizedEmail",
        rp."normalizedPhone",
        rp."displayName" as name,
        re.metadata
      FROM corretor_studio_radar_events re
      JOIN corretor_studio_radar_profiles rp ON re."profileId" = rp.id
      WHERE rp."teamId" = ${team.id}::uuid
        AND re."occurredAt" >= ${thirtyDaysAgo}
        AND re."eventType" = 'form.started'
        AND re.metadata->'origin'->>'recipientEmail' IS NOT NULL
      ORDER BY re."occurredAt" DESC
    `;

    // Agora verificar quais não têm lead associado
    const orphanEventsWithoutLead = [];
    for (const event of orphanEvents) {
      const leadIdentity = await prisma.radarIdentity.findFirst({
        where: {
          profileId: event.profileId,
          type: 'lead_id',
        },
      });

      if (!leadIdentity) {
        orphanEventsWithoutLead.push(event);
      }
    }

    console.log(`   🔍 ${orphanEvents.length} eventos form.started de email encontrados`);
    console.log(`   🔍 ${orphanEventsWithoutLead.length} sem lead associado\n`);

    if (orphanEventsWithoutLead.length === 0) {
      console.log('   ✅ Nenhum lead perdido detectado!\n');
      continue;
    }

    // 2.2 Validar cada evento órfão
    console.log('   📋 Validando eventos...\n');

    for (const event of orphanEventsWithoutLead) {
      let reason = 'unknown';
      let campaignId: string | null = null;
      let campaignName: string | null = null;

      // Validação 1: Tem email do destinatário?
      if (!event.recipientEmail) {
        reason = 'missing_recipient_email';
      } else {
        // Buscar EmailLog pelo recipientEmail e data próxima
        const emailLog = await prisma.emailLog.findFirst({
          where: {
            recipientEmail: event.recipientEmail,
            sentAt: {
              gte: new Date(event.occurredAt.getTime() - 7 * 24 * 60 * 60 * 1000), // até 7 dias antes
              lte: event.occurredAt,
            },
          },
          include: {
            dispatch: {
              include: {
                campaign: true,
              },
            },
          },
          orderBy: {
            sentAt: 'desc',
          },
        });

        if (!emailLog) {
          reason = 'emailLog_not_found';
        } else if (emailLog.status === 'failed') {
          reason = 'emailLog_failed';
        } else if (!event.normalizedEmail && !event.normalizedPhone) {
          reason = 'missing_contact_info';
        } else if (!event.name) {
          reason = 'missing_name';
        } else {
          reason = 'validation_gate_failure';
        }

        if (emailLog) {
          campaignId = emailLog.dispatch?.campaign?.id || null;
          campaignName = emailLog.dispatch?.campaign?.name || null;
        }
      }

      lostLeadCandidates.push({
        eventId: event.eventId,
        profileId: event.profileId,
        emailLogId: '', // não usamos mais este campo
        occurredAt: event.occurredAt,
        email: event.normalizedEmail || event.recipientEmail,
        phone: event.normalizedPhone,
        name: event.name,
        teamId: team.id,
        teamName: team.name,
        campaignId,
        campaignName,
        reason,
      });
    }

    console.log(`   ✅ ${orphanEventsWithoutLead.length} eventos validados\n`);
  }

  // 3. Gerar relatório
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 RELATÓRIO: Leads Perdidos');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`## Resumo Executivo\n`);
  console.log(`- **Período analisado:** ${thirtyDaysAgo.toISOString().split('T')[0]} até hoje`);
  console.log(`- **Times analisados:** ${teams.length}`);
  console.log(`- **Total de eventos órfãos:** ${lostLeadCandidates.length}\n`);

  // 3.1 Distribuição por time
  const byTeam = new Map<string, number>();
  lostLeadCandidates.forEach((candidate) => {
    byTeam.set(candidate.teamName, (byTeam.get(candidate.teamName) || 0) + 1);
  });

  console.log(`### Distribuição por Time\n`);
  Array.from(byTeam.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([teamName, count]) => {
      console.log(`- **${teamName}:** ${count} eventos órfãos`);
    });
  console.log('');

  // 3.2 Distribuição por razão
  const byReason = new Map<string, number>();
  lostLeadCandidates.forEach((candidate) => {
    byReason.set(candidate.reason, (byReason.get(candidate.reason) || 0) + 1);
  });

  console.log(`### Distribuição por Razão\n`);
  Array.from(byReason.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`- **${reason}:** ${count} eventos`);
    });
  console.log('');

  // 3.3 Leads recuperáveis (têm todos os dados)
  const recoverableLeads = lostLeadCandidates.filter(
    (c) => c.reason === 'validation_gate_failure' && (c.email || c.phone) && c.name
  );

  console.log(`### Leads Recuperáveis\n`);
  console.log(`- **Total:** ${recoverableLeads.length} leads podem ser recuperados`);
  console.log(`- **Critério:** form.started com emailLogId válido + nome + (email OU telefone)\n`);

  if (recoverableLeads.length > 0) {
    console.log(`### Sample de Leads Recuperáveis (primeiros 20)\n`);
    console.log(`| Time | Nome | Email | Telefone | Data | Campanha |\n`);
    console.log(`|------|------|-------|----------|------|----------|\n`);

    recoverableLeads.slice(0, 20).forEach((lead) => {
      const date = lead.occurredAt.toISOString().split('T')[0];
      const campaign = lead.campaignName ? lead.campaignName.substring(0, 30) : 'N/A';
      console.log(
        `| ${lead.teamName} | ${lead.name || 'N/A'} | ${lead.email || 'N/A'} | ${lead.phone || 'N/A'} | ${date} | ${campaign} |`
      );
    });
    console.log('');
  }

  // 3.4 Casos não recuperáveis
  const unrecoverableLeads = lostLeadCandidates.filter((c) => c.reason !== 'validation_gate_failure');

  if (unrecoverableLeads.length > 0) {
    console.log(`### Casos Não Recuperáveis\n`);
    console.log(`- **Total:** ${unrecoverableLeads.length} eventos não podem ser recuperados\n`);

    const reasonDetails = new Map<string, LostLeadCandidate[]>();
    unrecoverableLeads.forEach((candidate) => {
      if (!reasonDetails.has(candidate.reason)) {
        reasonDetails.set(candidate.reason, []);
      }
      reasonDetails.get(candidate.reason)!.push(candidate);
    });

    Array.from(reasonDetails.entries()).forEach(([reason, candidates]) => {
      console.log(`#### ${reason} (${candidates.length} casos)\n`);
      console.log(`Sample (primeiros 5):\n`);

      candidates.slice(0, 5).forEach((candidate, idx) => {
        console.log(`${idx + 1}. **${candidate.teamName}**`);
        console.log(`   - Nome: ${candidate.name || 'N/A'}`);
        console.log(`   - Email: ${candidate.email || 'N/A'}`);
        console.log(`   - Telefone: ${candidate.phone || 'N/A'}`);
        console.log(`   - Data: ${candidate.occurredAt.toISOString()}`);
        console.log(`   - EmailLog: ${candidate.emailLogId.substring(0, 8)}...`);
        console.log('');
      });
    });
  }

  // 4. Recomendações
  console.log(`## Recomendações\n`);

  if (recoverableLeads.length > 0) {
    console.log(`✅ **${recoverableLeads.length} leads podem ser recuperados**\n`);
    console.log(`Execute o script de backfill:\n`);
    console.log('```bash');
    console.log('npx tsx scripts/backfill-lost-leads.ts --dry-run');
    console.log('npx tsx scripts/backfill-lost-leads.ts --apply');
    console.log('```\n');
  } else {
    console.log(`✅ **Nenhum lead recuperável detectado**\n`);
    console.log(`Todos os eventos form.started com emailLogId criaram leads corretamente.`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Análise completa!');
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((error) => {
    console.error('❌ Erro na análise:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
