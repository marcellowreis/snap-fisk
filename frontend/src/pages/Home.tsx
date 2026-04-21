import { useState } from 'react';
import { api } from '../api';
import type { User, FiscalContext } from '../App';
import GuiaMei from './GuiaMei';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO','EX'];

// ── Operações por tipo de NF ─────────────────────────────────────────────
// tpNF: '1' = Saída (série 1), '0' = Entrada (série 2)
const OPERATIONS_BY_TIPO: Record<string, { value: string; label: string; icon: string }[]> = {
  '1': [ // SAÍDA
    { value: 'venda',         label: 'Venda',               icon: '🛒' },
    { value: 'remessa',       label: 'Remessa',              icon: '📦' },
    { value: 'devolucao',     label: 'Devolução ao Fornecedor', icon: '↩️' },
    { value: 'servico',       label: 'Prestação de Serviço', icon: '🔧' },
  ],
  '0': [ // ENTRADA
    { value: 'compra',        label: 'Compra',               icon: '🏪' },
    { value: 'retorno',       label: 'Retorno de Remessa',   icon: '🔄' },
    { value: 'devolucao',     label: 'Devolução de Venda',   icon: '📤' },
    { value: 'importacao',    label: 'Importação',           icon: '🌍' },
  ],
};

const PURPOSES_BY_TIPO: Record<string, Record<string, { value: string; label: string }[]>> = {
  '1': { // SAÍDA
    venda: [
      { value: 'normal',                label: 'Para revenda (empresa)' },
      { value: 'consumidor_final_pf',   label: 'Para consumidor final (PF)' },
      { value: 'substituicao_tributaria', label: 'Com Substituição Tributária' },
      { value: 'exportacao',            label: 'Exportação' },
    ],
    remessa: [
      { value: 'normal',                label: 'Para venda fora do estabelecimento' },
      { value: 'exportacao',            label: 'Com fim específico de exportação' },
    ],
    devolucao: [
      { value: 'venda',                 label: 'Devolução de compra ao fornecedor' },
    ],
    servico: [
      { value: 'normal',                label: 'Prestação de serviço (ISSQN)' },
    ],
  },
  '0': { // ENTRADA
    compra: [
      { value: 'normal',                label: 'Compra para comercialização' },
      { value: 'substituicao_tributaria', label: 'Compra com Substituição Tributária' },
    ],
    retorno: [
      { value: 'normal',                label: 'Retorno de remessa para venda' },
    ],
    devolucao: [
      { value: 'venda',                 label: 'Devolução recebida do cliente' },
    ],
    importacao: [
      { value: 'importacao',            label: 'Importação do exterior' },
    ],
  },
};

// Série por tipo de NF (padrão MEI)
// Saída → série 1 | Entrada → série 2
const SERIE_BY_TIPO: Record<string, string> = {
  '1': '1', // Saída
  '0': '2', // Entrada
};

type Props = {
  user: User;
  onNeedPlan: () => void;
  onEmitWithContext: (ctx: FiscalContext) => void;
};

export default function Home({ user, onNeedPlan, onEmitWithContext }: Props) {
  const company = user.company;
  const [originUf, setOriginUf] = useState(company?.uf ?? 'SP');
  const [destinationUf, setDestinationUf] = useState(company?.uf ?? 'SP');
  const [tpNF, setTpNF] = useState<'1' | '0'>('1'); // '1'=Saída '0'=Entrada
  const [operation, setOperation] = useState('');
  const [purpose, setPurpose] = useState('');
  // Pergunta sobre emissor anterior — só aparece se série ainda não foi definida
  const [jaEmitiu, setJaEmitiu] = useState<boolean | null>(null);
  const [serieConfirmada, setSerieConfirmada] = useState(false);

  // Série já definida = company.serie existe e não é '0'
  const serieJaDefinida = !!(company?.serie && company.serie !== '0');
  // Série atual baseada no tpNF
  const serieAtual = tpNF === '1'
    ? (company?.serie && company.serie !== '0' ? company.serie : '1')
    : '2';
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [showGuiaMei, setShowGuiaMei] = useState(false);

  const taxRegime = company?.taxRegime ?? 'simples_nacional';

  // Detecta automaticamente o tipo de operação pela UF
  const getFlowLabel = () => {
    if (destinationUf === 'EX') return '🌍 Exportação';
    if (originUf === 'EX') return '🌍 Importação';
    if (originUf !== destinationUf) return '🔀 Interestadual';
    return '📍 Intraestadual';
  };

  const handleTpNF = (tipo: '1' | '0') => {
    setTpNF(tipo);
    setOperation('');
    setPurpose('');
    setResult(null);
    setError('');
  };

  const confirmarEmissor = async () => {
    if (jaEmitiu === null) return;
    const novaSerie = jaEmitiu ? '3' : '1';
    try {
      await api.post('/api/company', {
        ...company,
        serie: novaSerie,
        proximaNF: 1,
      });
      setSerieConfirmada(true);
      // Atualiza company no user
      if (company) company.serie = novaSerie;
    } catch (e) {
      console.error('Erro ao salvar série:', e);
    }
  };

  const handleOperation = (op: string) => {
    setOperation(op);
    setPurpose('');
    setResult(null);
  };

  const handleConsult = async () => {
    if (!operation || !purpose) { setError('Preencha todos os campos.'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const data = await api.post('/api/fiscal-engine/query', {
        originUf,
        destinationUf,
        operation: tpNF === '0' && operation === 'compra' ? 'venda' : operation,
        purpose: tpNF === '0' && operation === 'importacao' ? 'importacao' : purpose,
        taxRegime,
        tpNF,
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const copyAll = () => {
    if (!result) return;
    const text = `SNAP FISK — ORIENTAÇÃO FISCAL\nCFOP: ${result.cfop ?? '-'}\nCST/CSOSN: ${result.cstCsosn ?? '-'}\nICMS: ${result.icmsApplicable ? 'Destaca' : 'Não destaca'}\nIPI: ${result.ipiApplicable ? 'Destaca' : 'Não destaca'}\nNatureza: ${result.naturezaOperacao ?? '-'}\n\nInformações Complementares:\n${result.informacoesComplementares ?? '-'}\n\nBase Legal:\n${result.baseLegal ?? '-'}`.trim();
    copy(text, 'all');
  };

  const handleEmitWithContext = () => {
    if (!result?.cfop) return;
    onEmitWithContext({
      operation,
      purpose,
      originUf,
      destinationUf,
      cfop: result.cfop,
      cstCsosn: result.cstCsosn || '102',
      naturezaOperacao: result.naturezaOperacao || '',
      informacoesComplementares: result.informacoesComplementares || '',
      mensagemAlerta: result.mensagemAlerta || '',
    });
  };

  return (
    <div>
      <GuiaMei isOpen={showGuiaMei} onClose={() => setShowGuiaMei(false)} />
      {/* Banner NT 2024.001 */}
      <div style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.35)',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, color: '#f59e0b' }}>
            Atualização da NT 2024.001 v1_20
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            A partir de 01/04/2025, houve uma restrição nos CFOPs que o MEI pode usar. O motor fiscal
            do Snap Fisk está configurado de acordo com as regras atualizadas (CSOSN 102/900 conforme operação).{' '}
            <a href="https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)', fontSize: 11 }}>Ver NT completa →</a>
          </div>
        </div>
      </div>


      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>🔍 Consultar Motor Fiscal</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowGuiaMei(true)}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ⚡ Guia MEI
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">UF Origem</label>
            <select className="form-select" value={originUf} onChange={e => { setOriginUf(e.target.value); setResult(null); }}>
              {UFS.map(uf => <option key={uf} value={uf}>{uf === 'EX' ? 'EX — Exterior' : uf}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">UF Destino</label>
            <select className="form-select" value={destinationUf} onChange={e => { setDestinationUf(e.target.value); setResult(null); }}>
              {UFS.map(uf => <option key={uf} value={uf}>{uf === 'EX' ? 'EX — Exterior' : uf}</option>)}
            </select>
          </div>
        </div>

        {/* Badge automático de tipo de operação */}
        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: 'inline-block',
            background: destinationUf === 'EX' || originUf === 'EX'
              ? 'rgba(99,102,241,0.15)'
              : originUf !== destinationUf
                ? 'rgba(245,158,11,0.15)'
                : 'rgba(34,197,94,0.15)',
            color: destinationUf === 'EX' || originUf === 'EX'
              ? 'var(--primary-light)'
              : originUf !== destinationUf
                ? 'var(--warning)'
                : 'var(--success)',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 600,
          }}>
            {getFlowLabel()}
          </span>
        </div>

        <div className="form-group">
          {/* Tipo de NF — Entrada ou Saída */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Tipo de Nota Fiscal</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { tipo: '1', label: '↑ Saída',  desc: 'Venda, remessa, serviço', serie: 'Série 1' },
                { tipo: '0', label: '↓ Entrada', desc: 'Compra, retorno, devolução', serie: 'Série 2' },
              ] as const).map(t => (
                <button
                  key={t.tipo}
                  onClick={() => handleTpNF(t.tipo)}
                  style={{
                    flex: 1, padding: '12px 10px',
                    borderRadius: 10,
                    border: `2px solid ${tpNF === t.tipo ? 'var(--primary)' : 'var(--border)'}`,
                    background: tpNF === t.tipo ? 'rgba(99,102,241,0.12)' : 'var(--bg)',
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15, color: tpNF === t.tipo ? 'var(--primary-light)' : 'var(--text)' }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, marginTop: 4,
                    color: tpNF === t.tipo ? 'var(--primary-light)' : 'var(--text-muted)',
                    background: tpNF === t.tipo ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                    borderRadius: 4, padding: '2px 6px', display: 'inline-block',
                  }}>
                    {t.serie}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Pergunta sobre emissor anterior — só na primeira vez ── */}
          {!serieJaDefinida && !serieConfirmada && (
            <div style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 4,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                📋 Já emitiu NF-e por outro sistema antes?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div
                  onClick={() => setJaEmitiu(false)}
                  style={{
                    border: `2px solid ${jaEmitiu === false ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                    background: jaEmitiu === false ? 'rgba(99,102,241,0.12)' : 'var(--bg)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>🆕 Não — primeira vez</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Numeração começa do zero · Série 1 (Saída) / Série 2 (Entrada)
                  </div>
                </div>
                <div
                  onClick={() => setJaEmitiu(true)}
                  style={{
                    border: `2px solid ${jaEmitiu === true ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                    background: jaEmitiu === true ? 'rgba(99,102,241,0.12)' : 'var(--bg)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>✅ Sim — Sebrae, outro sistema</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Usaremos Série 3 para não conflitar com suas NFs anteriores
                  </div>
                </div>
              </div>
              {jaEmitiu === true && (
                <div style={{
                  fontSize: 12, color: '#f59e0b',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 6, padding: '8px 12px', marginBottom: 12,
                }}>
                  ⚠️ A Série 3 é independente das suas NFs anteriores. Suas notas emitidas em outros sistemas continuam válidas.
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={confirmarEmissor}
                disabled={jaEmitiu === null}
                style={{ width: '100%', fontSize: 13 }}
              >
                Confirmar e continuar →
              </button>
            </div>
          )}

          {/* Só mostra operação se série já definida ou confirmada agora */}
          {(serieJaDefinida || serieConfirmada) && (
            <>
          <label className="form-label">Tipo de Operação</label>
          <select className="form-select" value={operation} onChange={e => handleOperation(e.target.value)}>
            <option value="">Selecione...</option>
            {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {operation && (
          <div className="form-group">
            <label className="form-label">Finalidade</label>
            <select className="form-select" value={purpose} onChange={e => setPurpose(e.target.value)}>
              <option value="">Selecione...</option>
              {([
                ...(PURPOSES[operation] ?? []),
                ...(operation === 'venda' ? (PURPOSES['venda_entrada'] ?? []) : []),
              ]).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        )}

        {company?.taxRegime && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            🏢 Regime: <strong>{company.taxRegime === 'simples_nacional' || company.taxRegime === 'mei' ? 'Simples Nacional / MEI' : company.taxRegime}</strong>
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        <button className="btn btn-primary" onClick={handleConsult} disabled={loading || !operation || !purpose}>
          {loading ? 'Consultando...' : '🔍 Consultar Motor Fiscal'}
        </button>
      </div>

      {result && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>Resultado</div>
            <button className="copy-btn" style={{ position: 'static' }} onClick={copyAll}>
              {copied === 'all' ? '✅ Copiado!' : '📋 Copiar tudo'}
            </button>
          </div>

          {result.cfop ? (
            <>
              <div className="result-grid">
                <div className="result-item">
                  <div className="result-label">CFOP</div>
                  <div className="result-value">{result.cfop}</div>
                </div>
                <div className="result-item">
                  <div className="result-label">CST/CSOSN</div>
                  <div className="result-value">{result.cstCsosn}</div>
                </div>
                <div className="result-item">
                  <div className="result-label">ICMS</div>
                  <div className={`result-value small ${result.icmsApplicable ? 'text-warning' : 'text-success'}`}>
                    {result.icmsApplicable ? 'Destaca' : 'Não destaca'}
                  </div>
                </div>
                <div className="result-item">
                  <div className="result-label">IPI</div>
                  <div className={`result-value small ${result.ipiApplicable ? 'text-warning' : 'text-success'}`}>
                    {result.ipiApplicable ? 'Destaca' : 'Não destaca'}
                  </div>
                </div>
              </div>

              {result.naturezaOperacao && (
                <div className="result-block">
                  <div className="result-block-label">Natureza da Operação</div>
                  <div className="result-block-text fw-700">{result.naturezaOperacao}</div>
                </div>
              )}

              {result.informacoesComplementares && (
                <div className="result-block">
                  <div className="result-block-label">Informações Complementares</div>
                  <div className="result-block-text">{result.informacoesComplementares}</div>
                  <button className="copy-btn" onClick={() => copy(result.informacoesComplementares, 'info')}>
                    {copied === 'info' ? '✅' : '📋'}
                  </button>
                </div>
              )}

              {result.baseLegal && (
                <div className="result-block">
                  <div className="result-block-label">Base Legal</div>
                  <div className="result-block-text">{result.baseLegal}</div>
                  <button className="copy-btn" onClick={() => copy(result.baseLegal, 'legal')}>
                    {copied === 'legal' ? '✅' : '📋'}
                  </button>
                </div>
              )}

              {result.mensagemAlerta && (
                <div className="alert alert-warning">⚠️ {result.mensagemAlerta}</div>
              )}

              <button className="btn btn-primary mt-16" onClick={handleEmitWithContext}>
                📄 Emitir NF-e com esses dados →
              </button>
            </>
          ) : (
            <div className="alert alert-warning">
              Nenhuma regra fiscal encontrada para essa combinação.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
