import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de regras fiscais para MEI...');

  const rules = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ATENÇÃO — NT 2024.001 v1.20 (vigente em produção desde 01/04/2025)
  // Para MEI (CRT=4), a regra N12a-90 restringe CFOPs permitidos:
  //   CSOSN 102 → APENAS 5.102 e 6.102
  //   CSOSN 900 → APENAS: 1.202, 1.904, 2.202, 2.904, 5.202, 5.904, 6.202,
  //               6.904, 1.501-1.506, 1.553, 2.501-2.506, 2.553,
  //               5.501, 5.502, 5.504, 5.505, 5.551, 5.933,
  //               6.501, 6.502, 6.504, 6.505, 6.551, 6.933
  //
  // CFOPs BLOQUEADOS para MEI (Rejeição 337 na SEFAZ):
  //   ❌ 5.915/6.915 (conserto), 1.916/2.916 (retorno conserto)
  //   ❌ 5.910/6.910 (bonificação/brinde)
  //   ❌ 5.912/5.913 (demonstração)
  //   ❌ 5.152 (transferência), 5.201 (devolução compra)
  //   ❌ 5.901/5.902 (industrialização), 5.905/5.906 (depósito)
  // ═══════════════════════════════════════════════════════════════════════════

    // ─── VENDAS — REVENDA ─────────────────────────────────────────────────────
    // O motor fiscal ajusta automaticamente:
    //   5.102 (intraestadual) → 6.102 (interestadual) → 7.102 (exportação)
    {
      originUf: null,
      destinationUf: null,
      operation: 'venda',
      purpose: 'normal',
      taxRegime: 'simples_nacional',
      cfop: '5.102',
      cstCsosn: '102',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Venda de Mercadoria',
      cfopEntradaVinculado: '1.102',
      geraCredito: false,
      temST: false,
      observation: 'Venda de mercadoria para revenda — Simples Nacional sem destaque de ICMS.',
      informacoesComplementares: 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de ICMS.',
      baseLegal: 'LC 123/2006 — Art. 23. CSOSN 102 — Tributada pelo Simples Nacional sem permissão de crédito.',
      mensagemAlerta: null,
    },

    // ─── VENDAS — CONSUMIDOR FINAL ────────────────────────────────────────────
    // 5.102 intraestadual → 6.108 interestadual (consumidor final não contribuinte)
    // O fiscal-engine.ts trata o 5→6 automaticamente
    // Para consumidor final interestadual usamos CFOP 6.108 — cadastramos regra específica
    {
      originUf: null,
      destinationUf: null,
      operation: 'venda',
      purpose: 'consumidor_final_pf',
      taxRegime: 'simples_nacional',
      cfop: '5.102',
      cstCsosn: '102',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Venda de Mercadoria a Consumidor Final',
      cfopEntradaVinculado: '1.102',
      geraCredito: false,
      temST: false,
      observation: 'Venda para consumidor final — Simples Nacional.',
      informacoesComplementares: 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de ICMS.',
      baseLegal: 'LC 123/2006 — Art. 23. CSOSN 102.',
      mensagemAlerta: null,
    },

    // ─── VENDAS — EXPORTAÇÃO (CFOP 7xxx) ─────────────────────────────────────
    {
      originUf: null,
      destinationUf: 'EX',
      operation: 'venda',
      purpose: 'exportacao',
      taxRegime: 'simples_nacional',
      cfop: '7.102',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 12,
      naturezaOperacao: 'Exportação de Mercadoria',
      cfopEntradaVinculado: null,
      geraCredito: false,
      temST: false,
      observation: 'Exportação de mercadoria para o exterior — imune de ICMS e IPI.',
      informacoesComplementares: 'Exportação de mercadoria. Operação imune de ICMS conforme CF/88 Art. 155, §2º, X, "a". Imune de IPI conforme CF/88 Art. 153, §3º, III.',
      baseLegal: 'CF/88 Art. 155, §2º, X, "a". CF/88 Art. 153, §3º, III. LC 123/2006.',
      mensagemAlerta: 'Exportação requer Registro de Exportação (RE) no SISCOMEX. Consulte um despachante aduaneiro.',
    },

    // ─── VENDAS — IMPORTAÇÃO (CFOP 3xxx entrada) ─────────────────────────────
    {
      originUf: 'EX',
      destinationUf: null,
      operation: 'venda',
      purpose: 'importacao',
      taxRegime: 'simples_nacional',
      cfop: '3.102',
      cstCsosn: '102',
      icmsApplicable: true,
      ipiApplicable: true,
      priority: 12,
      naturezaOperacao: 'Importação de Mercadoria',
      cfopEntradaVinculado: null,
      geraCredito: false,
      temST: false,
      observation: 'Importação de mercadoria do exterior — sujeita a II, IPI, ICMS, PIS/COFINS importação.',
      informacoesComplementares: 'Importação de mercadoria. Sujeita ao recolhimento de II, IPI, ICMS-Importação, PIS e COFINS-Importação. DI nº ___.',
      baseLegal: 'CF/88 Art. 153, I (II). CF/88 Art. 153, IV (IPI). LC 123/2006. Lei 10.865/2004 (PIS/COFINS Importação).',
      mensagemAlerta: 'Importação exige Declaração de Importação (DI) e desembaraço aduaneiro. Consulte um despachante aduaneiro.',
    },

    // ─── VENDAS — SUBSTITUIÇÃO TRIBUTÁRIA ────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'venda',
      purpose: 'substituicao_tributaria',
      taxRegime: 'simples_nacional',
      cfop: '5.405',
      cstCsosn: '500',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Venda de Mercadoria com ST',
      cfopEntradaVinculado: '1.405',
      geraCredito: false,
      temST: true,
      observation: 'Venda de mercadoria sujeita à substituição tributária — ICMS já recolhido pelo fabricante.',
      informacoesComplementares: 'Venda de mercadoria com ICMS retido por substituição tributária. ICMS-ST já recolhido anteriormente na cadeia.',
      baseLegal: 'LC 123/2006. CSOSN 500 — CRT com ICMS cobrado anteriormente por ST.',
      mensagemAlerta: 'Atenção: mercadoria com ST. Não destacar ICMS. Informar base de cálculo e valor do ICMS-ST retido.',
    },

    // ─── REMESSA PARA CONSERTO ────────────────────────────────────────────────
    // 5.915 intraestadual → 6.915 interestadual (ajuste automático)
    {
      originUf: null,
      destinationUf: null,
      operation: 'remessa',
      purpose: 'conserto', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.915',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Remessa para Conserto',
      cfopEntradaVinculado: '1.915',
      geraCredito: false,
      temST: false,
      observation: 'Remessa de mercadoria para conserto — não incide ICMS.',
      informacoesComplementares: 'Remessa para conserto. Não incide ICMS conforme art. 7º, IX do RICMS/SP. Prazo para retorno: 180 dias.',
      baseLegal: 'RICMS/SP — Art. 7º, IX. CSOSN 400 — Imune/Não tributada.',
      mensagemAlerta: 'Atenção: emitir NF de retorno (CFOP 5.916) quando o bem retornar após o conserto.',
    },

    // ─── RETORNO DE CONSERTO ──────────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'retorno',
      purpose: 'conserto', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.916',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Retorno de Mercadoria Enviada para Conserto',
      cfopEntradaVinculado: '1.916',
      geraCredito: false,
      temST: false,
      observation: 'Retorno de mercadoria após conserto — não incide ICMS.',
      informacoesComplementares: 'Retorno de mercadoria enviada para conserto. Não incide ICMS. Referente à NF de remessa nº ___.',
      baseLegal: 'RICMS/SP — Art. 7º, IX. CSOSN 400.',
      mensagemAlerta: 'Informar o número da NF de remessa original nas informações complementares.',
    },

    // ─── REMESSA PARA DEMONSTRAÇÃO ────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'remessa',
      purpose: 'demonstracao', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.912',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Remessa para Demonstração',
      cfopEntradaVinculado: '1.912',
      geraCredito: false,
      temST: false,
      observation: 'Remessa de mercadoria para demonstração — não incide ICMS.',
      informacoesComplementares: 'Remessa para demonstração. Não incide ICMS conforme Convênio ICMS 83/00. Prazo para retorno ou faturamento: 60 dias.',
      baseLegal: 'Convênio ICMS 83/2000. CSOSN 400.',
      mensagemAlerta: 'Prazo máximo de 60 dias para retornar ou faturar o produto em demonstração.',
    },

    // ─── RETORNO DE DEMONSTRAÇÃO ──────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'retorno',
      purpose: 'demonstracao', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.913',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Retorno de Mercadoria Enviada para Demonstração',
      cfopEntradaVinculado: '1.913',
      geraCredito: false,
      temST: false,
      observation: 'Retorno de mercadoria enviada para demonstração — não incide ICMS.',
      informacoesComplementares: 'Retorno de mercadoria enviada para demonstração. Não incide ICMS. Referente à NF nº ___.',
      baseLegal: 'Convênio ICMS 83/2000. CSOSN 400.',
      mensagemAlerta: 'Informar o número da NF de remessa original nas informações complementares.',
    },

    // ─── DEVOLUÇÃO ────────────────────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'devolucao',
      purpose: 'compra', // ⚠️ CFOP 5.201 BLOQUEADO para MEI - apenas 5.202 e 6.202 permitidos
      taxRegime: 'simples_nacional',
      cfop: '5.201',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Devolução de Compra para Comercialização',
      cfopEntradaVinculado: '1.201',
      geraCredito: false,
      temST: false,
      observation: 'Devolução de mercadoria comprada para comercialização.',
      informacoesComplementares: 'Devolução de mercadoria. Referente à NF de compra nº ___, emitida em ___. Simples Nacional — não gera crédito de ICMS.',
      baseLegal: 'LC 123/2006. CSOSN 400.',
      mensagemAlerta: 'Informar número e data da NF original de compra nas informações complementares.',
    },
    {
      originUf: null,
      destinationUf: null,
      operation: 'devolucao',
      purpose: 'venda',
      taxRegime: 'simples_nacional',
      cfop: '5.202',
      cstCsosn: '102',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Devolução de Venda de Mercadoria',
      cfopEntradaVinculado: '1.202',
      geraCredito: false,
      temST: false,
      observation: 'Recebimento em devolução de mercadoria vendida.',
      informacoesComplementares: 'Devolução de venda. Referente à NF de venda nº ___, emitida em ___. Simples Nacional.',
      baseLegal: 'LC 123/2006. CSOSN 102.',
      mensagemAlerta: 'Informar número e data da NF de venda original nas informações complementares.',
    },

    // ─── TRANSFERÊNCIA ────────────────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'transferencia',
      purpose: 'normal',
      taxRegime: 'simples_nacional',
      cfop: '5.152',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 8,
      naturezaOperacao: 'Transferência de Mercadoria',
      cfopEntradaVinculado: '1.152',
      geraCredito: false,
      temST: false,
      observation: 'Transferência de mercadoria entre estabelecimentos do mesmo titular.',
      informacoesComplementares: 'Transferência de mercadoria entre estabelecimentos do mesmo titular. Simples Nacional — não incide ICMS.',
      baseLegal: 'LC 123/2006. CSOSN 400.',
      mensagemAlerta: null,
    },

    // ─── REMESSA — BRINDE / BONIFICAÇÃO ──────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'remessa',
      purpose: 'brinde', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.910',
      cstCsosn: '102',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 9,
      naturezaOperacao: 'Remessa de Brinde ou Presente',
      cfopEntradaVinculado: null,
      geraCredito: false,
      temST: false,
      observation: 'Remessa de brinde ou presente — Simples Nacional.',
      informacoesComplementares: 'Remessa de brinde/presente. Mercadoria sem valor comercial para o destinatário. Simples Nacional.',
      baseLegal: 'LC 123/2006. CSOSN 102.',
      mensagemAlerta: 'Brindes devem ser escriturados como saída tributada mesmo sem cobrança ao destinatário.',
    },
    {
      originUf: null,
      destinationUf: null,
      operation: 'remessa',
      purpose: 'bonificacao', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.910',
      cstCsosn: '102',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 9,
      naturezaOperacao: 'Remessa em Bonificação, Doação ou Brinde',
      cfopEntradaVinculado: '1.910',
      geraCredito: false,
      temST: false,
      observation: 'Remessa de mercadoria a título de bonificação — Simples Nacional.',
      informacoesComplementares: 'Remessa de bonificação. Mercadoria enviada sem ônus ao destinatário. Simples Nacional.',
      baseLegal: 'LC 123/2006. CSOSN 102.',
      mensagemAlerta: 'Bonificação deve ser informada como saída normal para fins de controle de estoque.',
    },

    // ─── REMESSA — EXPORTAÇÃO ─────────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: 'EX',
      operation: 'remessa',
      purpose: 'exportacao',
      taxRegime: 'simples_nacional',
      cfop: '7.949',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 12,
      naturezaOperacao: 'Remessa para Exportação',
      cfopEntradaVinculado: null,
      geraCredito: false,
      temST: false,
      observation: 'Remessa de mercadoria para exportação — imune de ICMS e IPI.',
      informacoesComplementares: 'Remessa para exportação. Operação imune de ICMS e IPI conforme CF/88.',
      baseLegal: 'CF/88 Art. 155, §2º, X, "a". CF/88 Art. 153, §3º, III.',
      mensagemAlerta: 'Exportação requer Registro de Exportação (RE) no SISCOMEX.',
    },

    // ─── INDUSTRIALIZAÇÃO ─────────────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'remessa',
      purpose: 'industrializacao', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.901',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 9,
      naturezaOperacao: 'Remessa para Industrialização por Encomenda',
      cfopEntradaVinculado: '1.901',
      geraCredito: false,
      temST: false,
      observation: 'Remessa de insumos para industrialização por encomenda.',
      informacoesComplementares: 'Remessa para industrialização por encomenda. Não incide ICMS. Prazo para retorno: conforme contrato.',
      baseLegal: 'RICMS/SP — Art. 402. CSOSN 400.',
      mensagemAlerta: 'Emitir NF de retorno do produto industrializado (CFOP 5.902) ao receber o produto acabado.',
    },
    {
      originUf: null,
      destinationUf: null,
      operation: 'retorno',
      purpose: 'industrializacao', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.902',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 9,
      naturezaOperacao: 'Retorno de Mercadoria Industrializada por Encomenda',
      cfopEntradaVinculado: '1.902',
      geraCredito: false,
      temST: false,
      observation: 'Retorno de mercadoria após industrialização por encomenda.',
      informacoesComplementares: 'Retorno de industrialização por encomenda. Referente à NF de remessa nº ___. Simples Nacional.',
      baseLegal: 'RICMS/SP — Art. 402. CSOSN 400.',
      mensagemAlerta: 'Informar o número da NF de remessa original nas informações complementares.',
    },

    // ─── DEPÓSITO ─────────────────────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'remessa',
      purpose: 'deposito', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.905',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 8,
      naturezaOperacao: 'Remessa para Depósito Fechado ou Armazém Geral',
      cfopEntradaVinculado: '1.905',
      geraCredito: false,
      temST: false,
      observation: 'Remessa de mercadoria para depósito em armazém geral ou depósito fechado.',
      informacoesComplementares: 'Remessa para depósito. Não incide ICMS. Mercadoria permanece como propriedade do emitente.',
      baseLegal: 'RICMS/SP — Arts. 521 a 530. CSOSN 400.',
      mensagemAlerta: null,
    },
    {
      originUf: null,
      destinationUf: null,
      operation: 'retorno',
      purpose: 'deposito', // ⚠️ BLOQUEADO para MEI (NT 2024.001)
      taxRegime: 'simples_nacional',
      cfop: '5.906',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 8,
      naturezaOperacao: 'Retorno de Mercadoria Depositada em Armazém Geral',
      cfopEntradaVinculado: '1.906',
      geraCredito: false,
      temST: false,
      observation: 'Retorno de mercadoria depositada em armazém geral ou depósito fechado.',
      informacoesComplementares: 'Retorno de mercadoria em depósito. Referente à NF de remessa nº ___. Não incide ICMS.',
      baseLegal: 'RICMS/SP — Arts. 521 a 530. CSOSN 400.',
      mensagemAlerta: 'Informar o número da NF de remessa original nas informações complementares.',
    },

    // ─── PRESTAÇÃO DE SERVIÇO ─────────────────────────────────────────────────
    {
      originUf: null,
      destinationUf: null,
      operation: 'servico',
      purpose: 'normal',
      taxRegime: 'simples_nacional',
      cfop: '5.933',
      cstCsosn: '400',
      icmsApplicable: false,
      ipiApplicable: false,
      priority: 10,
      naturezaOperacao: 'Prestação de Serviço',
      cfopEntradaVinculado: null,
      geraCredito: false,
      temST: false,
      observation: 'Prestação de serviço por MEI optante pelo Simples Nacional.',
      informacoesComplementares: 'Documento emitido por ME ou EPP optante pelo Simples Nacional. ISS recolhido pelo Simples Nacional.',
      baseLegal: 'LC 123/2006 — Art. 23. CSOSN 400.',
      mensagemAlerta: 'MEI prestador de serviço deve verificar se o município exige NFS-e em vez de NF-e.',
    },
  ];

  let criadas = 0;
  let atualizadas = 0;

  for (const rule of rules) {
    const existing = await prisma.fiscalRule.findFirst({
      where: {
        operation: rule.operation,
        purpose: rule.purpose,
        taxRegime: rule.taxRegime,
        destinationUf: rule.destinationUf ?? null,
        originUf: rule.originUf ?? null,
      },
    });

    if (existing) {
      await prisma.fiscalRule.update({
        where: { id: existing.id },
        data: { ...rule, active: true },
      });
      atualizadas++;
    } else {
      await prisma.fiscalRule.create({ data: { ...rule, active: true } });
      criadas++;
    }
  }

  console.log(`✅ Seed concluído: ${criadas} regras criadas, ${atualizadas} atualizadas.`);
  console.log(`📋 Total de regras fiscais: ${rules.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
