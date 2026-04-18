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

// ─── REGRA DE CFOP POR ORIGEM / DESTINO ──────────────────────────────────────
//
//  Saída:
//    5xxx → intraestadual (mesmo estado)
//    6xxx → interestadual (outro estado do Brasil)
//    7xxx → exportação (exterior)
//
//  Entrada:
//    1xxx → intraestadual (mesmo estado)
//    2xxx → interestadual (outro estado do Brasil)
//    3xxx → importação (exterior)
//
// O motor fiscal armazena regras base com CFOP 5xxx ou 1xxx.
// Esta função ajusta automaticamente conforme origem/destino.

const EXTERIOR = 'EX'; // UF fictícia para representar exterior

const ajustarCfop = (
  cfop: string,
  originUf: string,
  destinationUf: string,
  purpose?: string,
): string => {
  if (!cfop || cfop.length < 4) return cfop;

  const primeiro = cfop[0];
  const resto = cfop.slice(1); // últimos 3 dígitos, ex: "102"

  const isExteriorOrigem = originUf === EXTERIOR || originUf?.toUpperCase() === 'EX';
  const isExteriorDestino = destinationUf === EXTERIOR || destinationUf?.toUpperCase() === 'EX';
  const isInterestadual = originUf !== destinationUf && !isExteriorOrigem && !isExteriorDestino;

  // ── SAÍDA (regra base 5xxx) ──────────────────────────────────────
  if (primeiro === '5') {
    if (isExteriorDestino) return '7' + resto;      // exportação

    if (isInterestadual) {
      // Consumidor final não contribuinte interestadual → 6.108
      if (purpose === 'consumidor_final_pf' && resto === '.102') return '6.108';
      return '6' + resto;                           // interestadual genérico
    }

    // Consumidor final intraestadual → mantém 5.102 (não é 5.108)
    return cfop;                                    // intraestadual (mantém 5xxx)
  }

  // ── ENTRADA (regra base 1xxx) ────────────────────────────────────
  if (primeiro === '1') {
    if (isExteriorOrigem)  return '3' + resto;      // importação
    if (isInterestadual)   return '2' + resto;      // interestadual
    return cfop;                                     // intraestadual (mantém 1xxx)
  }

  // CFOP já ajustado (2,3,6,7) — não altera
  return cfop;
};

// Ajusta também a natureza da operação conforme o CFOP resultante
const ajustarNatureza = (
  natureza: string | null,
  cfop: string,
  cfopOriginal: string,
): string | null => {
  if (!natureza) return natureza;
  if (cfop === cfopOriginal) return natureza; // não mudou, mantém

  const primeiro = cfop[0];
  const map: Record<string, string> = {
    '2': 'Interestadual',
    '3': 'Importação',
    '6': 'Interestadual',
    '7': 'Exportação',
  };

  const sufixo = map[primeiro];
  if (!sufixo) return natureza;

  // Se já contém a palavra, não duplica
  if (natureza.toLowerCase().includes(sufixo.toLowerCase())) return natureza;

  return `${natureza} — ${sufixo}`;
};

// Alerta ao usuário quando o CFOP foi ajustado
const gerarAlerta = (
  cfopOriginal: string,
  cfopAjustado: string,
  alertaExistente: string | null,
): string | null => {
  if (cfopOriginal === cfopAjustado) return alertaExistente;

  const msg = `CFOP ajustado de ${cfopOriginal} para ${cfopAjustado} (operação ${
    cfopAjustado[0] === '6' ? 'interestadual' :
    cfopAjustado[0] === '7' ? 'de exportação' :
    cfopAjustado[0] === '2' ? 'interestadual' :
    cfopAjustado[0] === '3' ? 'de importação' : ''
  }).`;

  return alertaExistente ? `${alertaExistente} | ${msg}` : msg;
};

// ─── ESPECIFICIDADE DA REGRA ──────────────────────────────────────────────────

const specificityScore = (rule: FiscalRule): number => {
  let score = 0;
  if (rule.originUf !== null) score += 1;
  if (rule.destinationUf !== null) score += 1;
  if (rule.operation !== null) score += 1;
  if (rule.purpose !== null) score += 1;
  if (rule.taxRegime !== null) score += 1;
  return score;
};

// ─── MOTOR FISCAL PRINCIPAL ───────────────────────────────────────────────────

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
      { OR: [
        { taxRegime: input.taxRegime },
        { taxRegime: input.taxRegime === 'mei' ? 'simples_nacional' : input.taxRegime },
        { taxRegime: null },
      ]},
    ],
  };

  const candidates = await prisma.fiscalRule.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  });

  const bestRule = candidates
    .map((rule) => ({ rule, specificity: specificityScore(rule) }))
    .sort((a, b) => {
      if (b.rule.priority !== a.rule.priority) return b.rule.priority - a.rule.priority;
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      return b.rule.updatedAt.getTime() - a.rule.updatedAt.getTime();
    })[0]?.rule;

  let result: FiscalEngineResult;

  if (bestRule) {
    // Ajusta CFOP conforme origem/destino
    const cfopOriginal = bestRule.cfop;
    const cfopAjustado = ajustarCfop(cfopOriginal, input.originUf, input.destinationUf, input.purpose);
    const naturezaAjustada = ajustarNatureza(bestRule.naturezaOperacao, cfopAjustado, cfopOriginal);
    const alertaAjustado = gerarAlerta(cfopOriginal, cfopAjustado, bestRule.mensagemAlerta);

    // Ajusta também o CFOP de entrada vinculado (se houver)
    const cfopEntradaAjustado = bestRule.cfopEntradaVinculado
      ? ajustarCfop(bestRule.cfopEntradaVinculado, input.destinationUf, input.originUf)
      : bestRule.cfopEntradaVinculado;

    result = {
      cfop: cfopAjustado,
      cstCsosn: bestRule.cstCsosn,
      icmsApplicable: bestRule.icmsApplicable,
      ipiApplicable: bestRule.ipiApplicable,
      observation: bestRule.observation,
      naturezaOperacao: naturezaAjustada,
      cfopEntradaVinculado: cfopEntradaAjustado,
      geraCredito: bestRule.geraCredito,
      temST: bestRule.temST,
      informacoesComplementares: bestRule.informacoesComplementares,
      baseLegal: bestRule.baseLegal,
      mensagemAlerta: alertaAjustado,
      ruleId: bestRule.id,
    };
  } else {
    result = {
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
  }

  // Salva histórico
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
