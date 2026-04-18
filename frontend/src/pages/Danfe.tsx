import { useEffect, useRef } from 'react';

type Props = {
  invoice: any;
  company: any;
  onClose: () => void;
};

export default function Danfe({ invoice, company, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const fmt = (v: number) =>
    (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '';

  const customer = invoice.customer;
  const items = invoice.items ?? [];
  const vTotal = invoice.vTotal ?? 0;
  const vFrete = invoice.vFrete ?? 0;
  const vDesc = invoice.vDesc ?? 0;
  const vProd = items.reduce((s: number, i: any) => s + (i.vProd ?? 0), 0);
  const chave = invoice.chaveAcesso ?? '';
  const chaveFormatada = chave.replace(/(\d{4})/g, '$1 ').trim();

  const gerarBarras = (chave: string) => {
    if (!chave) return '<div style="color:#999;font-size:7pt;padding:2mm 0;">Chave não disponível</div>';
    let bars = '';
    for (let i = 0; i < chave.length; i++) {
      const w = (parseInt(chave[i]) % 3) + 1;
      const h = i % 5 === 0 ? 12 : 8;
      bars += `<span style="display:inline-block;width:${w}px;height:${h}mm;background:#000;margin-right:0.5px;vertical-align:bottom;"></span>`;
    }
    return `<div style="height:12mm;display:flex;align-items:flex-end;overflow:hidden;">${bars}</div>`;
  };

  const pagLabel = (tPag: string) => {
    const m: Record<string, string> = {
      '01': 'Dinheiro', '03': 'Cartão de Crédito', '04': 'Cartão de Débito',
      '15': 'Boleto', '17': 'PIX', '90': 'Sem Pagamento',
    };
    return m[tPag] ?? 'Sem Pagamento';
  };

  const freteLabel = (mod: string) => {
    const m: Record<string, string> = {
      '0': '0 — Emitente (CIF)', '1': '1 — Destinatário (FOB)',
      '2': '2 — Terceiros', '9': '9 — Sem Frete',
    };
    return m[mod] ?? '9 — Sem Frete';
  };

  const gerarHtml = () => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>DANFE NF-e nº ${invoice.numero}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#000;background:#fff;}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:5mm;}
.bold{font-weight:bold;}
.center{text-align:center;}
.right{text-align:right;}

/* Canhoto */
.canhoto{border:0.5pt dashed #000;padding:2mm;margin-bottom:3mm;display:grid;grid-template-columns:1fr 36mm;gap:3mm;align-items:center;}
.canhoto-left{font-size:6.5pt;line-height:1.6;}
.canhoto-right{text-align:right;}

/* Cabeçalho */
.hdr{display:grid;grid-template-columns:1fr 48mm 46mm;border:0.5pt solid #000;}
.hdr-emit{padding:2mm;border-right:0.5pt solid #000;}
.hdr-emit .razao{font-size:9pt;font-weight:bold;margin-bottom:1mm;}
.hdr-emit .end{font-size:6.5pt;line-height:1.5;}
.hdr-emit .cnpj{font-size:6.5pt;margin-top:1mm;}
.hdr-danfe{border-right:0.5pt solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm;text-align:center;}
.hdr-danfe .dt{font-size:14pt;font-weight:bold;letter-spacing:4pt;}
.hdr-danfe .ds{font-size:6pt;margin:1mm 0;line-height:1.4;}
.hdr-danfe .tpbox{border:0.5pt solid #000;display:inline-block;padding:0.5mm 3mm;font-size:8pt;font-weight:bold;margin:1mm 0;}
.hdr-danfe .nnum{font-size:10pt;font-weight:bold;}
.hdr-danfe .nserie{font-size:7pt;}
.hdr-danfe .hmg{font-size:5.5pt;color:#c00;border:0.5pt solid #c00;padding:1mm 1.5mm;margin-top:1mm;line-height:1.4;}
.hdr-chave{padding:2mm;display:flex;flex-direction:column;gap:1.5mm;}
.lbl{font-size:5.5pt;text-transform:uppercase;color:#444;}
.val{font-size:7.5pt;font-weight:bold;}
.val-sm{font-size:6.5pt;font-weight:bold;word-break:break-all;}

/* Seções */
.sec{border:0.5pt solid #000;border-top:none;}
.sec-title{background:#ccc;font-size:5.5pt;font-weight:bold;text-transform:uppercase;padding:0.8mm 1.5mm;border-bottom:0.5pt solid #000;letter-spacing:0.5pt;}
.campo{padding:0.8mm 1.5mm;border-right:0.5pt solid #000;}
.campo:last-child{border-right:none;}
.row{display:flex;}
.row .campo{flex:1;}
.bt{border-top:0.5pt solid #000;}
.grid2{display:grid;grid-template-columns:1fr 1fr;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;}
.grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;}
.grid7{display:grid;grid-template-columns:repeat(7,1fr);}

/* Tabela itens */
table.itens{width:100%;border-collapse:collapse;font-size:6pt;}
table.itens thead tr{background:#ccc;}
table.itens th{border:0.5pt solid #000;padding:0.8mm;text-align:center;font-size:5.5pt;font-weight:bold;text-transform:uppercase;}
table.itens td{border:0.5pt solid #000;padding:0.8mm;vertical-align:middle;}
table.itens tr:nth-child(even) td{background:#f8f8f8;}
.tdr{text-align:right;}
.tdc{text-align:center;}

/* Linha fiscal */
.emit-fiscal{border:0.5pt solid #000;border-top:none;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;}

@media print{
  body{margin:0;}
  .page{padding:3mm;}
  .no-print{display:none!important;}
}
</style>
</head>
<body>
<div class="page">

<!-- CANHOTO -->
<div class="canhoto">
  <div class="canhoto-left">
    <div class="bold" style="font-size:7.5pt;">${company?.razaoSocial ?? ''}</div>
    <div>${[company?.logradouro, company?.numero, company?.bairro].filter(Boolean).join(', ')}</div>
    <div>${company?.xMun ?? ''} — ${company?.uf ?? ''} — ${company?.cep ? 'CEP ' + company.cep : ''}</div>
    ${company?.fone ? '<div>Fone: ' + company.fone + '</div>' : ''}
    <div style="margin-top:2mm;border-top:0.5pt dashed #999;padding-top:1.5mm;">
      RECEBEMOS DE <strong>${company?.razaoSocial ?? ''}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO
    </div>
    <div style="margin-top:2mm;">
      DATA DE RECEBIMENTO: ____/____/________ &nbsp;&nbsp; ASSINATURA DO RECEBEDOR: _________________________________
    </div>
  </div>
  <div class="canhoto-right">
    <div style="font-size:5.5pt;text-transform:uppercase;font-weight:bold;">NF-e</div>
    <div style="font-size:13pt;font-weight:bold;">Nº ${String(invoice.numero).padStart(6,'0')}</div>
    <div style="font-size:7pt;">Série ${invoice.serie ?? '0'}</div>
  </div>
</div>

<!-- CABEÇALHO PRINCIPAL -->
<div class="hdr">
  <div class="hdr-emit">
    <div class="razao">${company?.razaoSocial ?? ''}</div>
    <div class="end">
      ${[company?.logradouro, company?.numero].filter(Boolean).join(', ')}<br/>
      ${company?.bairro ?? ''} — ${company?.xMun ?? ''} — ${company?.uf ?? ''}<br/>
      ${company?.cep ? 'CEP: ' + company.cep : ''}
      ${company?.fone ? ' &nbsp; Fone: ' + company.fone : ''}
    </div>
    <div class="cnpj">
      <span class="lbl">CNPJ: </span><strong>${company?.cnpj ?? ''}</strong>
      ${company?.ie ? ' &nbsp; <span class="lbl">IE: </span><strong>' + company.ie + '</strong>' : ''}
    </div>
  </div>

  <div class="hdr-danfe">
    <div class="dt">DANFE</div>
    <div class="ds">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>
    <div style="display:flex;gap:3mm;align-items:center;justify-content:center;margin:1mm 0;">
      <div style="font-size:5.5pt;text-align:left;line-height:1.6;">0 — ENTRADA<br/>1 — SAÍDA</div>
      <div class="tpbox">${invoice.tpNF ?? '1'}</div>
    </div>
    <div class="nnum">Nº ${String(invoice.numero).padStart(9,'0')}</div>
    <div class="nserie">SÉRIE: ${invoice.serie ?? '0'}</div>
    <div style="font-size:5.5pt;margin-top:0.5mm;">PÁGINA 1 DE 1</div>
    ${invoice.ambiente === '2' ? '<div class="hmg">HOMOLOGAÇÃO — SEM VALOR FISCAL</div>' : ''}
  </div>

  <div class="hdr-chave">
    <div>
      <div class="lbl">Chave de Acesso</div>
      ${gerarBarras(chave)}
      <div style="font-size:6pt;font-weight:bold;word-break:break-all;letter-spacing:0.5pt;margin-top:0.5mm;">${chaveFormatada || '— não disponível —'}</div>
      <div style="font-size:5pt;color:#555;margin-top:0.5mm;">Consulta em www.nfe.fazenda.gov.br/portal</div>
    </div>
    <div>
      <div class="lbl">Natureza da Operação</div>
      <div style="font-size:8pt;font-weight:bold;">${invoice.natOp ?? ''}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5mm;">
      <div>
        <div class="lbl">Protocolo de Autorização</div>
        <div style="font-size:6.5pt;font-weight:bold;">${invoice.protocolo ?? '—'}</div>
      </div>
      <div>
        <div class="lbl">Data de Emissão</div>
        <div style="font-size:7pt;font-weight:bold;">${fmtDate(invoice.dhEmi ?? invoice.createdAt)}</div>
      </div>
    </div>
  </div>
</div>

<!-- DADOS FISCAIS DO EMITENTE -->
<div class="emit-fiscal">
  <div class="campo"><div class="lbl">Inscrição Estadual</div><div class="val-sm">${company?.ie ?? 'ISENTO'}</div></div>
  <div class="campo"><div class="lbl">Inscrição Estadual Subst. Trib.</div><div class="val-sm">—</div></div>
  <div class="campo"><div class="lbl">CNPJ</div><div class="val-sm">${company?.cnpj ?? ''}</div></div>
  <div class="campo" style="border-right:none;"><div class="lbl">CRT</div><div class="val-sm">4 — Simples Nacional / MEI</div></div>
</div>

<!-- DESTINATÁRIO -->
<div class="sec">
  <div class="sec-title">Destinatário / Remetente</div>
  <div style="display:grid;grid-template-columns:2fr 1fr 1fr;">
    <div class="campo"><div class="lbl">Nome / Razão Social</div><div class="val-sm">${customer?.nome ?? 'NÃO IDENTIFICADO'}</div></div>
    <div class="campo"><div class="lbl">CNPJ / CPF</div><div class="val-sm">${customer?.cpfCnpj ?? '—'}</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">Data de Emissão</div><div class="val-sm">${fmtDate(invoice.dhEmi ?? invoice.createdAt)}</div></div>
  </div>
  <div class="bt" style="display:grid;grid-template-columns:2fr 1fr 0.6fr 0.4fr 1fr;">
    <div class="campo"><div class="lbl">Endereço</div><div class="val-sm">${customer?.logradouro ?? '—'}${customer?.numero ? ', ' + customer.numero : ''}</div></div>
    <div class="campo"><div class="lbl">Bairro / Distrito</div><div class="val-sm">${customer?.bairro ?? '—'}</div></div>
    <div class="campo"><div class="lbl">CEP</div><div class="val-sm">${customer?.cep ?? '—'}</div></div>
    <div class="campo"><div class="lbl">UF</div><div class="val-sm">${customer?.uf ?? '—'}</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">Município</div><div class="val-sm">${customer?.xMun ?? '—'}</div></div>
  </div>
  <div class="bt" style="display:grid;grid-template-columns:1fr 1fr 2fr 1fr;">
    <div class="campo"><div class="lbl">Fone / Fax</div><div class="val-sm">${customer?.fone ?? '—'}</div></div>
    <div class="campo"><div class="lbl">Inscrição Estadual</div><div class="val-sm">${customer?.ie ?? '—'}</div></div>
    <div class="campo"><div class="lbl">E-mail</div><div class="val-sm">${customer?.email ?? '—'}</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">Ind. IE Dest.</div><div class="val-sm">${customer?.indIEDest === '1' ? '1 — Contribuinte' : customer?.indIEDest === '2' ? '2 — Isento' : '9 — Não contribuinte'}</div></div>
  </div>
</div>

<!-- FATURA -->
<div class="sec">
  <div class="sec-title">Fatura</div>
  <div class="grid4">
    <div class="campo"><div class="lbl">Número / Duplicata</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">Vencimento</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">Forma de Pagamento</div><div class="val-sm">${pagLabel(invoice.tPag)}</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">Valor Pago</div><div class="val-sm">R$ ${fmt(invoice.vPag ?? 0)}</div></div>
  </div>
</div>

<!-- CÁLCULO DO IMPOSTO -->
<div class="sec">
  <div class="sec-title">Cálculo do Imposto</div>
  <div class="grid7">
    <div class="campo"><div class="lbl">Base Cálc. ICMS</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">Valor do ICMS</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">Base Cálc. ICMS ST</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">Valor ICMS ST</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">V. Imp. Importação</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">V. ICMS UF Remet.</div><div class="val-sm">0,00</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">Valor do FCP</div><div class="val-sm">0,00</div></div>
  </div>
  <div class="bt grid7">
    <div class="campo"><div class="lbl">Valor do Frete</div><div class="val-sm">R$ ${fmt(vFrete)}</div></div>
    <div class="campo"><div class="lbl">Valor do Seguro</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">Desconto</div><div class="val-sm">R$ ${fmt(vDesc)}</div></div>
    <div class="campo"><div class="lbl">Outras Despesas</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">Valor do IPI</div><div class="val-sm">0,00</div></div>
    <div class="campo"><div class="lbl">V. Aprox. Tributos</div><div class="val-sm">0,00</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl" style="font-weight:bold;">V. Total da Nota</div><div style="font-size:9pt;font-weight:bold;">R$ ${fmt(vTotal)}</div></div>
  </div>
</div>

<!-- TRANSPORTADOR -->
<div class="sec">
  <div class="sec-title">Transportador / Volumes Transportados</div>
  <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 0.5fr 1fr;">
    <div class="campo"><div class="lbl">Razão Social</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">Frete por Conta</div><div class="val-sm">${freteLabel(invoice.modFrete)}</div></div>
    <div class="campo"><div class="lbl">Código ANTT</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">Placa do Veículo</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">UF</div><div class="val-sm">—</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">CNPJ / CPF</div><div class="val-sm">—</div></div>
  </div>
  <div class="bt" style="display:grid;grid-template-columns:2fr 1fr 0.5fr 1fr 1fr 1fr;">
    <div class="campo"><div class="lbl">Endereço</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">Município</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">UF</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">Insc. Estadual</div><div class="val-sm">—</div></div>
    <div class="campo"><div class="lbl">Quantidade / Espécie</div><div class="val-sm">—</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">Peso Bruto / Líquido</div><div class="val-sm">—</div></div>
  </div>
</div>

<!-- DADOS DOS PRODUTOS -->
<div class="sec">
  <div class="sec-title">Dados dos Produtos / Serviços</div>
  <table class="itens">
    <thead>
      <tr>
        <th style="width:12mm;">Código</th>
        <th>Descrição do Produto / Serviço</th>
        <th style="width:15mm;">NCM/SH</th>
        <th style="width:9mm;">CST</th>
        <th style="width:9mm;">CFOP</th>
        <th style="width:7mm;">UN</th>
        <th style="width:11mm;">Qtd.</th>
        <th style="width:15mm;">Vl. Unit.</th>
        <th style="width:15mm;">Vl. Total</th>
        <th style="width:11mm;">BC ICMS</th>
        <th style="width:11mm;">Vl. ICMS</th>
        <th style="width:9mm;">Vl. IPI</th>
        <th style="width:9mm;">Al. ICMS</th>
        <th style="width:9mm;">Al. IPI</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: any, idx: number) => `
      <tr>
        <td class="tdc">${item.cProd ?? String(idx + 1).padStart(4, '0')}</td>
        <td>${item.xProd ?? ''}</td>
        <td class="tdc">${item.ncm ?? ''}</td>
        <td class="tdc">${item.csosn ?? '102'}</td>
        <td class="tdc">${item.cfop ?? ''}</td>
        <td class="tdc">${item.uCom ?? 'PC'}</td>
        <td class="tdr">${Number(item.qCom ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
        <td class="tdr">${fmt(item.vUnCom ?? 0)}</td>
        <td class="tdr">${fmt(item.vProd ?? 0)}</td>
        <td class="tdr">0,00</td>
        <td class="tdr">0,00</td>
        <td class="tdr">0,00</td>
        <td class="tdr">0,00</td>
        <td class="tdr">0,00</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- ISSQN -->
<div class="sec">
  <div class="sec-title">Cálculo do ISSQN</div>
  <div class="grid4">
    <div class="campo"><div class="lbl">Inscrição Municipal</div><div class="val-sm">${company?.im ?? '—'}</div></div>
    <div class="campo"><div class="lbl">Valor Total dos Serviços</div><div class="val-sm">R$ 0,00</div></div>
    <div class="campo"><div class="lbl">Base de Cálculo do ISSQN</div><div class="val-sm">R$ 0,00</div></div>
    <div class="campo" style="border-right:none;"><div class="lbl">Valor do ISSQN</div><div class="val-sm">R$ 0,00</div></div>
  </div>
</div>

<!-- DADOS ADICIONAIS -->
<div class="sec">
  <div class="sec-title">Dados Adicionais</div>
  <div class="grid2">
    <div class="campo" style="min-height:18mm;border-right:0.5pt solid #000;">
      <div class="lbl">Informações Complementares</div>
      <div class="val-sm" style="line-height:1.6;margin-top:1mm;">
        ${invoice.infCpl ? invoice.infCpl + '<br/>' : ''}
        DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE ICMS, ISS E IPI.
        ${invoice.ambiente === '2' ? '<br/><span style="color:#c00;font-weight:bold;">NOTA EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL.</span>' : ''}
      </div>
    </div>
    <div class="campo" style="min-height:18mm;border-right:none;">
      <div class="lbl">Reserva ao Fisco</div>
    </div>
  </div>
</div>

<div style="text-align:center;font-size:5.5pt;color:#666;margin-top:2mm;">
  Emitido por Snap Fisk &nbsp;·&nbsp; ${fmtDate(invoice.createdAt)} &nbsp;·&nbsp; NF-e nº ${invoice.numero} Série ${invoice.serie ?? '0'}
</div>

</div>
</body>
</html>`;

  useEffect(() => {
    if (frameRef.current) {
      const doc = frameRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(gerarHtml());
        doc.close();
      }
    }
  }, [invoice]);

  const handlePrint = () => {
    frameRef.current?.contentWindow?.print();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1a1a2e', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', flexShrink: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
          📄 DANFE — NF-e nº {String(invoice.numero).padStart(9, '0')} · Série {invoice.serie ?? '0'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handlePrint}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ Imprimir / Salvar PDF
          </button>
          <button
            onClick={onClose}
            style={{ background: '#333', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            ✕ Fechar
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', justifyContent: 'center', background: '#2a2a2a' }}>
        <iframe
          ref={frameRef}
          style={{ width: '215mm', minHeight: '297mm', background: '#fff', border: 'none', borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,0.6)' }}
          title="DANFE"
        />
      </div>
    </div>
  );
}
