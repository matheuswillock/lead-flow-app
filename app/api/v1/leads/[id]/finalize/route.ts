import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/infra/data/prisma';
import { Output } from '@/lib/output';
import { getTeamAccess, hasLeadAccess } from '@/app/api/v1/utils/teamAccess';
import { invalidateLeadCache, invalidatePortfolioCache } from '@/lib/cache/invalidation';
import { MAX_DECIMAL_LABEL, MAX_DECIMAL_VALUE } from '../../DTO/leadValueLimits';
import { sanitizeDocumentDigits, sanitizeRgCpfDigits } from '@/lib/masks';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { syncPortfolioToRadarInline } from '@/app/api/useCases/radar/syncPortfolioToRadarInline';
import { syncFinalizedToRadarInline } from '@/app/api/useCases/radar/syncFinalizedToRadarInline';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ['Acesso negado: função SDR necessária para visualizar leads.'], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { id: leadId } = await params;
    const body = await request.json();

    const {
      amount,
      startDateAt,
      finalizedDateAt,
      notes,
      closerId,
      contractHolder,
      operadora,
      productName,
      contractFileUrl,
      contractStoragePath,
      dependents,
      source,
      contractType,
    } = body;

    const normalizedContractType: 'individual' | 'corporate' | 'adhesion' =
      contractType === 'corporate' || contractType === 'adhesion' ? contractType : 'individual';

    if (!amount || amount <= 0) {
      return NextResponse.json(
        new Output(false, [], ['O valor do contrato deve ser maior que zero'], null),
        { status: 400 }
      );
    }

    if (amount > MAX_DECIMAL_VALUE) {
      return NextResponse.json(
        new Output(false, [], [`O valor do contrato deve ser menor que ${MAX_DECIMAL_LABEL}`], null),
        { status: 400 }
      );
    }

    if (!startDateAt) {
      return NextResponse.json(
        new Output(false, [], ['A data de início é obrigatória'], null),
        { status: 400 }
      );
    }

    if (!finalizedDateAt) {
      return NextResponse.json(
        new Output(false, [], ['A data de finalização é obrigatória'], null),
        { status: 400 }
      );
    }

    if (!closerId) {
      return NextResponse.json(
        new Output(false, [], ['O closer responsável é obrigatório'], null),
        { status: 400 }
      );
    }

    const normalizedSource: 'crm' | 'brokerage_transfer' =
      source === 'brokerage_transfer' ? 'brokerage_transfer' : 'crm';

    if (!contractHolder || typeof contractHolder !== 'object') {
      return NextResponse.json(
        new Output(false, [], ['Os dados do titular do contrato são obrigatórios'], null),
        { status: 400 }
      );
    }

    if (!operadora) {
      return NextResponse.json(
        new Output(false, [], ['A operadora é obrigatória'], null),
        { status: 400 }
      );
    }

    const dependentsList: { name: string; birthDate: string; parentesco: string; document?: string }[] =
      Array.isArray(dependents) ? dependents : [];

    const holderName =
      typeof contractHolder.name === 'string' ? contractHolder.name.trim() : '';
    const holderRazaoSocial =
      typeof contractHolder.razaoSocial === 'string' ? contractHolder.razaoSocial.trim() : '';
    const holderBirthDate = new Date(contractHolder.birthDate);
    const holderDocument = sanitizeRgCpfDigits(
      typeof contractHolder.document === 'string' ? contractHolder.document : ''
    );
    const holderCnpj = sanitizeDocumentDigits(
      typeof contractHolder.cnpj === 'string' ? contractHolder.cnpj : ''
    );

    if (!holderName) {
      return NextResponse.json(
        new Output(false, [], ['O nome do titular é obrigatório'], null),
        { status: 400 }
      );
    }

    if (Number.isNaN(holderBirthDate.getTime())) {
      return NextResponse.json(
        new Output(false, [], ['A data de nascimento do titular é obrigatória'], null),
        { status: 400 }
      );
    }

    if (normalizedContractType === 'corporate') {
      if (!holderRazaoSocial) {
        return NextResponse.json(
          new Output(false, [], ['A Razão Social é obrigatória para contratos Empresariais'], null),
          { status: 400 }
        );
      }
      if (!holderCnpj) {
        return NextResponse.json(
          new Output(false, [], ['O CNPJ é obrigatório para contratos Empresariais'], null),
          { status: 400 }
        );
      }
    } else {
      if (!holderDocument) {
        return NextResponse.json(
          new Output(false, [], ['O CPF do titular é obrigatório'], null),
          { status: 400 }
        );
      }
    }

    for (const dep of dependentsList) {
      if (!dep.name || !dep.birthDate || !dep.parentesco) {
        return NextResponse.json(
          new Output(false, [], ['Cada dependente deve ter nome, data de nascimento e parentesco'], null),
          { status: 400 }
        );
      }
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ['Lead não encontrado ou sem permissão no seu time.'], null),
        { status: 404 }
      );
    }

    const createdAt = new Date(lead.createdAt);
    const finalizedDate = new Date(finalizedDateAt);
    const durationInDays = Math.floor(
      (finalizedDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    let createdOrUpdatedPortfolioId: string | null = null;

    const result = await prisma.$transaction(async (tx) => {
      const leadFinalized = await tx.leadFinalized.create({
        data: {
          leadId,
          amount,
          startDateAt: new Date(startDateAt),
          finalizedDateAt: new Date(finalizedDateAt),
          duration: durationInDays,
          contractType: normalizedContractType,
          notes: notes || null,
          closerId: closerId || null,
          operadora: operadora || null,
          productName: productName || null,
          contractFileUrl: contractFileUrl || null,
          contractStoragePath: contractStoragePath || null,
        },
      });

      await tx.leadFinalizedHolder.create({
        data: {
          leadFinalizedId: leadFinalized.id,
          name: holderName,
          razaoSocial: holderRazaoSocial || null,
          birthDate: holderBirthDate,
          document: holderDocument,
          cnpj: holderCnpj || null,
        },
      });

      if (dependentsList.length > 0) {
        await tx.leadFinalizedDependent.createMany({
          data: dependentsList.map((dep) => ({
            leadFinalizedId: leadFinalized.id,
            name: dep.name,
            birthDate: new Date(dep.birthDate),
            parentesco: dep.parentesco,
            document: dep.document ? sanitizeRgCpfDigits(dep.document) : '',
          })),
        });
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: { status: 'contract_finalized', currentValue: amount },
      });

      await tx.leadActivity.create({
        data: {
          leadId,
          type: 'status_change',
          body: `Contrato finalizado no valor de R$ ${amount.toFixed(2)}`,
          payload: {
            previousStatus: lead.status,
            newStatus: 'contract_finalized',
            amount,
            startDateAt,
            finalizedDateAt,
            duration: durationInDays,
          },
          createdBy: teamAccess.access.profileId,
        },
      });

      const portfolio = await tx.leadPortfolio.upsert({
        where: { leadId },
        create: {
          leadId,
          teamId: teamAccess.access.teamId,
          portfolioStatus: 'active',
          source: normalizedSource,
        },
        update: {
          source: normalizedSource,
        },
        select: { id: true },
      });
      createdOrUpdatedPortfolioId = portfolio.id;

      return { leadFinalized, lead: updatedLead };
    });

    const teamId = teamAccess.access.teamId;
    invalidateLeadCache({ leadId, teamId });
    invalidatePortfolioCache({ teamId, leadId });
    if (createdOrUpdatedPortfolioId) {
      syncPortfolioToRadarInline(createdOrUpdatedPortfolioId, teamId);
    }
    syncFinalizedToRadarInline({ teamId, finalizedId: result.leadFinalized.id });
    return NextResponse.json(
      new Output(true, ['Contrato finalizado com sucesso'], [], result),
      { status: 200 }
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('[FinalizeLeadRoute][POST] Erro ao finalizar contrato:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro interno ao finalizar contrato'], null),
      { status: 500 }
    );
  }
}
