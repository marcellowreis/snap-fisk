import { FiscalRule, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type FiscalInput = {
  originUf: string;
  destinationUf: string;
  operation: string;
  purpose: string;
  taxRegime: string;
};

export type FiscalEngineResult = {
  cfop: string | null;
  cstCsosn: string | null;
  icmsApplicable: boolean | null;
  ipiApplicable: boolean | null;
  observation: string | null;
  naturezaOperacao: string | null;
  cfopEntradaVinculado: string | null;
  geraCredito: boolean | null;
  temST: boolean | null;
  informacoesComplementares: string | null;
  baseLegal: string | null;
  mensagemAlerta: string | null;
  ruleId: string | null;
};

const specificityScore = (rule: FiscalRule): number => {
  let score = 0;
  if (rule.originUf !== null) score += 1;
  if (rule.destinationUf !== null) score += 1;
  if (rule.operation !== null) score += 1;
  if (rule.purpose !== null) score += 1;
  if (rule.taxRegime !== null) score += 1;
  return score;
};

export const resolveFiscalRule = async (
  input: FiscalInput,
  userId?: string,
): Promise<FiscalEngineResult> => {
  const where: Prisma.FiscalRuleWhereInput = {
    active: true,
    AND: [
      { OR: [{ originUf: input.originUf }, { originUf: null }] },
      { OR: [{ destinationUf: input.destinationUf }, { destinationUf: null }] },
      { OR: [{ operation: input.operation }, { operation: null }] },
      { OR: [{ purpose: input.purpose }, { purpose: null }] },
      { OR: [{ taxRegime: input.taxRegime }, { taxRegime: input.taxRegime === 'mei' ? 'simples_nacional' : input.taxRegime }, { taxRegime: null }] },
    ],
  };

  const candidates = await prisma.fiscalRule.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  });

  const bestRule = candidates
    .map((rule) => ({ rule, specificity: specificityScore(rule) }))
    .sort((a, b) => {
      if (b.rule.priority !== a.rule.priority) {
        return b.rule.priority - a.rule.priority;
      }
      if (b.specificity !== a.specificity) {
        return b.specificity - a.specificity;
      }
      return b.rule.updatedAt.getTime() - a.rule.updatedAt.getTime();
    })[0]?.rule;

  const result: FiscalEngineResult = bestRule
    ? {
        cfop: bestRule.cfop,
        cstCsosn: bestRule.cstCsosn,
        icmsApplicable: bestRule.icmsApplicable,
        ipiApplicable: bestRule.ipiApplicable,
        observation: bestRule.observation,
        naturezaOperacao: bestRule.naturezaOperacao,
        cfopEntradaVinculado: bestRule.cfopEntradaVinculado,
        geraCredito: bestRule.geraCredito,
        temST: bestRule.temST,
        informacoesComplementares: bestRule.informacoesComplementares,
        baseLegal: bestRule.baseLegal,
        mensagemAlerta: bestRule.mensagemAlerta,
        ruleId: bestRule.id,
      }
    : {
        cfop: null,
        cstCsosn: null,
        icmsApplicable: null,
        ipiApplicable: null,
        observation: 'Nenhuma regra fiscal ativa compatível encontrada.',
        naturezaOperacao: null,
        cfopEntradaVinculado: null,
        geraCredito: null,
        temST: null,
        informacoesComplementares: null,
        baseLegal: null,
        mensagemAlerta: null,
        ruleId: null,
      };

  await prisma.guidedIssuance.create({
    data: {
      userId: userId ?? null,
      originUf: input.originUf,
      destinationUf: input.destinationUf,
      operation: input.operation,
      purpose: input.purpose,
      taxRegime: input.taxRegime,
      ruleId: result.ruleId,
      cfop: result.cfop,
      cstCsosn: result.cstCsosn,
      icmsApplicable: result.icmsApplicable,
      ipiApplicable: result.ipiApplicable,
      observation: result.observation,
      naturezaOperacao: result.naturezaOperacao,
      cfopEntradaVinculado: result.cfopEntradaVinculado,
      geraCredito: result.geraCredito,
      temST: result.temST,
      informacoesComplementares: result.informacoesComplementares,
      baseLegal: result.baseLegal,
      mensagemAlerta: result.mensagemAlerta,
    },
  });

  return result;
};
