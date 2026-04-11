import { useState } from 'react';
import { api } from '../api';
import type { User } from '../App';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const OPERATIONS = [
  { value: 'venda', label: 'Venda' },
  { value: 'remessa', label: 'Remessa' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'devolucao', label: 'Devolução' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'servico', label: 'Prestação de Serviço' },
];

const PURPOSES: Record<string, { value: string; label: string }[]> = {
  venda: [
    { value: 'normal', label: 'Venda normal' },
    { value: 'consumidor_final_pf', label: 'Para consumidor final PF' },
    { value: 'interestadual', label: 'Interestadual' },
    { value: 'consumidor_final_pf_interestadual', label: 'Consumidor final PF — outro estado' },
    { value: 'substituicao_tributaria', label: 'Com Substituição Tributária' },
  ],
  remessa: [
    { value: 'conserto', label: 'Para conserto' },
    { value: 'conserto_interestadual', label: 'Para conserto — outro estado' },
    { value: 'demonstracao', label: 'Para demonstração' },
    { value: 'industrializacao', label: 'Para industrialização' },
    { value: 'deposito', label: 'Para depósito' },
    { value: 'brinde', label: 'Brinde' },
    { value: 'bonificacao', label: 'Bonificação' },
  ],
  retorno: [
    { value: 'conserto', label: 'De conserto' },
    { value: 'demonstracao', label: 'De demonstração' },
    { value: 'industrializacao', label: 'De industrialização' },
    { value: 'deposito', label: 'De depósito' },
  ],
  devolucao: [
    { value: 'compra', label: 'Devolução de compra' },
    { value: 'venda', label: 'Devolução de venda' },
  ],
  transferencia: [{ value: 'normal', label: 'Entre estabelecimentos' }],
  servico: [{ value: 'normal', label: 'Prestação de serviço' }],
};

const TAX_REGIMES = [
  { value: 'simples_nacional', label: 'Simples Nacional / MEI' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
];

type Props = {
  user: User;
  onNeedPlan: () => void;
  onEmit: () => void;
};

export default function Home({ user, onNeedPlan, onEmit }: Props) {
  const company = user.company;
  const [originUf, setOriginUf] = useState(company?.uf ?? 'SP');
  const [destinationUf, setDestinationUf] = useState('SP');
  const [operation, setOperation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [taxRegime, setTaxRegime] = useState(company?.taxRegime ?? 'simples_nacional');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

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
      const data = await api.post('/api/fiscal-engine/query', { originUf, destinationUf, operation, purpose, taxRegime });
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
    const text = `SNAP FISK — ORIENTAÇÃO FISCAL\nCFOP: ${result.cfop ?? '-'}\nCST/CSOSN: ${result.cstCsosn ?? '-'}\nICMS: ${result.icmsApplicable ? 'Sim' : 'Não'}\nIPI: ${result.ipiApplicable ? 'Sim' : 'Não'}\nNatureza: ${result.naturezaOperacao ?? '-'}\n\nInformações Complementares:\n${result.informacoesComplementares ?? '-'}\n\nBase Legal:\n${result.baseLegal ?? '-'}`.trim();
    copy(text, 'all');
  };

  return (
    <div>
      {/* Atalho para emitir NF */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))', border: 'none', cursor: 'pointer' }} onClick={onEmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>📄</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Emitir NF-e</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Com preenchimento automático dos campos fiscais</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 20 }}>→</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Consultar Motor Fiscal</div>

        <div className="form-group">
          <label className="form-label">UF Origem</label>
          <select className="form-select" value={originUf} onChange={e => setOriginUf(e.target.value)}>
            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">UF Destino</label>
          <select className="form-select" value={destinationUf} onChange={e => setDestinationUf(e.target.value)}>
            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>

        <div className="form-group">
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
              {(PURPOSES[operation] ?? []).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Regime Tributário</label>
          <select className="form-select" value={taxRegime} onChange={e => setTaxRegime(e.target.value)}>
            {TAX_REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

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

              <button className="btn btn-primary mt-16" onClick={onEmit}>
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
