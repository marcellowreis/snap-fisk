import { useEffect, useRef } from 'react';

type Props = {
  invoice: any;
  company: any;
  onClose: () => void;
};

export default function Danfe({ invoice, company, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const fmt = (v: number) =>
    v?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0,00';

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR');

  const customer = invoice.customer;
  const items = invoice.items ?? [];
  const vTotal = invoice.vTotal ?? 0;
  const vFrete = invoice.vFrete ?? 0;
  const vDesc = invoice.vDesc ?? 0;

  // Gera o HTML do DANFE simplificado
  const gerarHtml = () => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>DANFE — NF-e nº ${invoice.numero}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #000; background: #fff; padding: 10mm; }
  .danfe { width: 190mm; margin: 0 auto; }

  /* Cabeçalho */
  .header { display: grid; grid-template-columns: 1fr 60mm 45mm; border: 1px solid #000; }
  .header-logo { padding: 6px 8px; border-right: 1px solid #000; }
  .header-logo .razao { font-size: 11px; font-weight: bold; margin-bottom: 2px; }
  .header-logo .endereco { font-size: 8px; color: #333; line-height: 1.4; }
  .header-danfe { border-right: 1px solid #000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; text-align: center; }
  .header-danfe .title { font-size: 13px; font-weight: bold; letter-spacing: 2px; }
  .header-danfe .subtitle { font-size: 8px; margin: 2px 0; }
  .header-danfe .nf { font-size: 11px; font-weight: bold; margin-top: 4px; }
  .header-danfe .serie { font-size: 8px; }
  .header-danfe .homolog { font-size: 7px; color: #c00; border: 1px solid #c00; padding: 2px 4px; margin-top: 4px; }
  .header-chave { padding: 6px; display: flex; flex-direction: column; justify-content: space-between; }
  .header-chave .label { font-size: 7px; color: #555; margin-bottom: 2px; }
  .header-chave .chave { font-size: 7px; word-break: break-all; font-weight: bold; }
  .header-chave .barcode { font-size: 28px; letter-spacing: -2px; margin: 4px 0; font-family: 'Libre Barcode 128', monospace; }

  /* Seções */
  .section { border: 1px solid #000; border-top: none; }
  .section-title { background: #eee; font-size: 7px; font-weight: bold; padding: 2px 6px; letter-spacing: 1px; border-bottom: 1px solid #000; text-transform: uppercase; }
  .fields { display: flex; flex-wrap: wrap; }
  .field { padding: 3px 6px; border-right: 1px solid #ccc; flex: 1; min-width: 40mm; }
  .field:last-child { border-right: none; }
  .field .flabel { font-size: 7px; color: #555; }
  .field .fvalue { font-size: 9px; font-weight: bold; margin-top: 1px; }

  /* Destinatário */
  .dest-grid { display: grid; grid-template-columns: 1fr 35mm 20mm; }
  .dest-grid2 { display: grid; grid-template-columns: 1fr 25mm 25mm 20mm; }
  .dest-grid3 { display: grid; grid-template-columns: 1fr 35mm 20mm 20mm; }

  /* Itens */
  table { width: 100%; border-collapse: collapse; font-size: 8px; }
  thead tr { background: #eee; }
  th { padding: 3px 4px; text-align: left; font-size: 7px; border: 1px solid #ccc; font-weight: bold; text-transform: uppercase; }
  td { padding: 3px 4px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .td-right { text-align: right; }
  .td-center { text-align: center; }

  /* Totais */
  .totais { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; border-top: none; }
  .totais-left { border-right: 1px solid #000; padding: 6px; }
  .totais-right { padding: 6px; }
  .total-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #eee; font-size: 8px; }
  .total-row:last-child { border-bottom: none; }
  .total-grand { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; font-weight: bold; border-top: 1px solid #000; margin-top: 4px; }

  /* Pagamento */
  .pag-section { border: 1px solid #000; border-top: none; }

  /* Rodapé */
  .footer { margin-top: 4px; font-size: 7px; color: #555; text-align: center; }

  .inline-field { display: inline-block; }
  .row-fields { display: flex; border-bottom: 1px solid #ccc; }
  .row-fields:last-child { border-bottom: none; }
  .row-fields .field { border-bottom: none; }

  @media print {
    body { padding: 5mm; }
    button { display: none !important; }
  }
</style>
</head>
<body>
<div class="danfe">

  <!-- CABEÇALHO -->
  <div class="header">
    <div class="header-logo">
      <div class="razao">${company?.razaoSocial ?? ''}</div>
      <div class="endereco">
        ${[company?.logradouro, company?.numero, company?.bairro].filter(Boolean).join(', ')}<br/>
        ${[company?.xMun, company?.uf, company?.cep ? 'CEP ' + company.cep : ''].filter(Boolean).join(' — ')}<br/>
        ${company?.fone ? 'Fone: ' + company.fone : ''} ${company?.email ? '· ' + company.email : ''}
      </div>
      <div style="margin-top:6px; font-size:8px; color:#555;">
        CNPJ: <strong>${company?.cnpj ?? ''}</strong>
        ${company?.ie ? ' · IE: ' + company.ie : ''}
      </div>
    </div>
    <div class="header-danfe">
      <div class="title">DANFE</div>
      <div class="subtitle">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>
      <div style="margin:4px 0;font-size:8px;">
        <span style="border:1px solid #000;padding:1px 6px;">${invoice.tpNF === '1' ? '1 - SAÍDA' : '0 - ENTRADA'}</span>
      </div>
      <div class="nf">Nº ${String(invoice.numero).padStart(9, '0')}</div>
      <div class="serie">Série ${invoice.serie ?? '0'}</div>
      ${invoice.ambiente === '2' ? '<div class="homolog">HOMOLOGAÇÃO — SEM VALOR FISCAL</div>' : ''}
    </div>
    <div class="header-chave">
      <div>
        <div class="label">Chave de Acesso</div>
        <div class="chave">${invoice.chaveAcesso ?? '— não disponível —'}</div>
      </div>
      <div style="margin-top:6px;">
        <div class="label">Natureza da Operação</div>
        <div style="font-size:9px;font-weight:bold;">${invoice.natOp ?? ''}</div>
      </div>
      <div style="margin-top:6px;">
        <div class="label">Data de Emissão</div>
        <div style="font-size:9px;font-weight:bold;">${fmtDate(invoice.dhEmi ?? invoice.createdAt)}</div>
      </div>
    </div>
  </div>

  <!-- EMITENTE -->
  <div class="section">
    <div class="section-title">Emitente</div>
    <div class="row-fields">
      <div class="field" style="flex:2">
        <div class="flabel">Razão Social</div>
        <div class="fvalue">${company?.razaoSocial ?? ''}</div>
      </div>
      <div class="field">
        <div class="flabel">CNPJ</div>
        <div class="fvalue">${company?.cnpj ?? ''}</div>
      </div>
      <div class="field">
        <div class="flabel">IE</div>
        <div class="fvalue">${company?.ie ?? 'ISENTO'}</div>
      </div>
      <div class="field">
        <div class="flabel">CRT</div>
        <div class="fvalue">4 — MEI</div>
      </div>
    </div>
    <div class="row-fields">
      <div class="field" style="flex:2">
        <div class="flabel">Logradouro</div>
        <div class="fvalue">${company?.logradouro ?? ''}, ${company?.numero ?? 'SN'}</div>
      </div>
      <div class="field">
        <div class="flabel">Bairro</div>
        <div class="fvalue">${company?.bairro ?? ''}</div>
      </div>
      <div class="field">
        <div class="flabel">Município</div>
        <div class="fvalue">${company?.xMun ?? ''}</div>
      </div>
      <div class="field">
        <div class="flabel">UF</div>
        <div class="fvalue">${company?.uf ?? ''}</div>
      </div>
      <div class="field">
        <div class="flabel">CEP</div>
        <div class="fvalue">${company?.cep ?? ''}</div>
      </div>
    </div>
  </div>

  <!-- DESTINATÁRIO -->
  <div class="section">
    <div class="section-title">Destinatário / Remetente</div>
    ${customer ? `
    <div class="row-fields">
      <div class="field" style="flex:2">
        <div class="flabel">Nome / Razão Social</div>
        <div class="fvalue">${customer.nome}</div>
      </div>
      <div class="field">
        <div class="flabel">CPF / CNPJ</div>
        <div class="fvalue">${customer.cpfCnpj}</div>
      </div>
      <div class="field">
        <div class="flabel">IE</div>
        <div class="fvalue">${customer.ie ?? '—'}</div>
      </div>
    </div>
    <div class="row-fields">
      <div class="field" style="flex:2">
        <div class="flabel">Logradouro</div>
        <div class="fvalue">${customer.logradouro ?? '—'}, ${customer.numero ?? 'SN'}</div>
      </div>
      <div class="field">
        <div class="flabel">Bairro</div>
        <div class="fvalue">${customer.bairro ?? '—'}</div>
      </div>
      <div class="field">
        <div class="flabel">Município</div>
        <div class="fvalue">${customer.xMun ?? '—'}</div>
      </div>
      <div class="field">
        <div class="flabel">UF</div>
        <div class="fvalue">${customer.uf ?? '—'}</div>
      </div>
      <div class="field">
        <div class="flabel">CEP</div>
        <div class="fvalue">${customer.cep ?? '—'}</div>
      </div>
    </div>
    ${customer.email || customer.fone ? `
    <div class="row-fields">
      ${customer.email ? `<div class="field"><div class="flabel">E-mail</div><div class="fvalue">${customer.email}</div></div>` : ''}
      ${customer.fone ? `<div class="field"><div class="flabel">Fone</div><div class="fvalue">${customer.fone}</div></div>` : ''}
    </div>` : ''}
    ` : `<div style="padding:8px 6px;font-size:9px;color:#555;">Sem destinatário informado</div>`}
  </div>

  <!-- ITENS -->
  <div class="section">
    <div class="section-title">Dados dos Produtos / Serviços</div>
    <table>
      <thead>
        <tr>
          <th style="width:8mm">Cód.</th>
          <th style="width:50mm">Descrição</th>
          <th style="width:18mm">NCM</th>
          <th style="width:10mm">CFOP</th>
          <th style="width:8mm">Un.</th>
          <th style="width:12mm" class="td-right">Qtd.</th>
          <th style="width:18mm" class="td-right">Vl. Unit.</th>
          <th style="width:18mm" class="td-right">Vl. Total</th>
          <th style="width:10mm" class="td-center">CSOSN</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item: any, idx: number) => `
        <tr>
          <td class="td-center">${item.cProd ?? String(idx + 1).padStart(4, '0')}</td>
          <td>${item.xProd}</td>
          <td class="td-center">${item.ncm}</td>
          <td class="td-center">${item.cfop}</td>
          <td class="td-center">${item.uCom}</td>
          <td class="td-right">${Number(item.qCom).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td class="td-right">R$ ${fmt(item.vUnCom)}</td>
          <td class="td-right">R$ ${fmt(item.vProd)}</td>
          <td class="td-center">${item.csosn}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- TOTAIS -->
  <div class="totais">
    <div class="totais-left">
      <div style="font-size:7px;font-weight:bold;text-transform:uppercase;margin-bottom:4px;color:#555;">Cálculo do Imposto</div>
      <div class="total-row"><span>Base Cálculo ICMS</span><span>R$ 0,00</span></div>
      <div class="total-row"><span>Valor do ICMS</span><span>R$ 0,00</span></div>
      <div class="total-row"><span>Base Cálculo ICMS ST</span><span>R$ 0,00</span></div>
      <div class="total-row"><span>Valor ICMS ST</span><span>R$ 0,00</span></div>
      <div class="total-row"><span>Valor IPI</span><span>R$ 0,00</span></div>
      <div class="total-row"><span>Valor PIS</span><span>R$ 0,00</span></div>
      <div class="total-row"><span>Valor COFINS</span><span>R$ 0,00</span></div>
    </div>
    <div class="totais-right">
      <div style="font-size:7px;font-weight:bold;text-transform:uppercase;margin-bottom:4px;color:#555;">Totais da NF-e</div>
      <div class="total-row"><span>Total dos Produtos</span><span>R$ ${fmt(items.reduce((s: number, i: any) => s + (i.vProd ?? 0), 0))}</span></div>
      <div class="total-row"><span>Frete</span><span>R$ ${fmt(vFrete)}</span></div>
      <div class="total-row"><span>Desconto</span><span>R$ ${fmt(vDesc)}</span></div>
      <div class="total-row"><span>Outras Despesas</span><span>R$ 0,00</span></div>
      <div class="total-grand"><span>VALOR TOTAL DA NF-e</span><span>R$ ${fmt(vTotal)}</span></div>
    </div>
  </div>

  <!-- TRANSPORTE -->
  <div class="section">
    <div class="section-title">Transporte / Volumes Transportados</div>
    <div class="row-fields">
      <div class="field" style="flex:2">
        <div class="flabel">Modalidade do Frete</div>
        <div class="fvalue">${
          invoice.modFrete === '0' ? '0 — Por conta do emitente'
          : invoice.modFrete === '1' ? '1 — Por conta do destinatário'
          : '9 — Sem frete'
        }</div>
      </div>
      <div class="field">
        <div class="flabel">Valor do Frete</div>
        <div class="fvalue">R$ ${fmt(vFrete)}</div>
      </div>
    </div>
  </div>

  <!-- PAGAMENTO -->
  <div class="section">
    <div class="section-title">Pagamento</div>
    <div class="row-fields">
      <div class="field">
        <div class="flabel">Forma de Pagamento</div>
        <div class="fvalue">${
          invoice.tPag === '01' ? 'Dinheiro'
          : invoice.tPag === '03' ? 'Cartão de Crédito'
          : invoice.tPag === '04' ? 'Cartão de Débito'
          : invoice.tPag === '15' ? 'Boleto'
          : invoice.tPag === '17' ? 'PIX'
          : 'Sem Pagamento'
        }</div>
      </div>
      <div class="field">
        <div class="flabel">Valor</div>
        <div class="fvalue">R$ ${fmt(invoice.vPag ?? 0)}</div>
      </div>
    </div>
  </div>

  <!-- INFORMAÇÕES ADICIONAIS -->
  ${invoice.infCpl ? `
  <div class="section">
    <div class="section-title">Informações Complementares</div>
    <div style="padding:6px 8px;font-size:8px;line-height:1.5;">${invoice.infCpl}</div>
  </div>` : ''}

  <!-- RODAPÉ -->
  <div class="footer" style="margin-top:8px;">
    ${invoice.ambiente === '2'
      ? '<strong style="color:#c00;">⚠ NOTA EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL</strong><br/>'
      : ''}
    Emitido por Snap Fisk · ${fmtDate(invoice.createdAt)} · NF-e nº ${invoice.numero} Série ${invoice.serie}
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
      {/* Toolbar */}
      <div style={{ background: '#1a1a2e', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
          📄 DANFE — NF-e nº {String(invoice.numero).padStart(9, '0')}
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

      {/* Preview */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', justifyContent: 'center' }}>
        <iframe
          ref={frameRef}
          style={{
            width: '210mm',
            minHeight: '297mm',
            background: '#fff',
            border: 'none',
            borderRadius: 4,
            boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
          }}
          title="DANFE"
        />
      </div>
    </div>
  );
}
