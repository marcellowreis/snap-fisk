import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import type { User } from '../App';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  tipoPessoa: string;
  cpfCnpj: string;
  nome: string;
  ie?: string;
  uf?: string;
  xMun?: string;
};

type Product = {
  id: string;
  descricao: string;
  ncm: string;
  unidade: string;
  valorUnit: number;
};

type Item = {
  id: string;
  productId?: string;
  xProd: string;
  ncm: string;
  ncmSugerido?: string;
  ncmConflito?: boolean;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  csosn: string;
  saveProduct: boolean;
};

type FiscalResult = {
  cfop: string | null;
  cstCsosn: string | null;
  naturezaOperacao: string | null;
  informacoesComplementares: string | null;
  mensagemAlerta: string | null;
};

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

const UNIDADES = ['PC', 'UN', 'KG', 'MT', 'LT', 'CX', 'PAR', 'JG', 'SC', 'M2'];
const FORMAS_PAG = [
  { value: '90', label: 'Sem pagamento' },
  { value: '01', label: 'Dinheiro' },
  { value: '03', label: 'Cartão de crédito' },
  { value: '04', label: 'Cartão de débito' },
  { value: '05', label: 'Crédito loja' },
  { value: '15', label: 'Boleto' },
  { value: '17', label: 'PIX' },
];

const newItem = (): Item => ({
  id: Math.random().toString(36).slice(2),
  xProd: '',
  ncm: '',
  cfop: '',
  uCom: 'PC',
  qCom: 1,
  vUnCom: 0,
  vProd: 0,
  csosn: '102',
  saveProduct: false,
});

type Props = { user: User; onBack: () => void };

export default function Emit({ user, onBack }: Props) {
  const company = user.company;

  // Destinatário
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);

  // Operação / Motor fiscal
  const [tpNF, setTpNF] = useState<'0' | '1'>('1');
  const [operation, setOperation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [fiscalResult, setFiscalResult] = useState<FiscalResult | null>(null);
  const [loadingFiscal, setLoadingFiscal] = useState(false);

  // Itens
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [showProductList, setShowProductList] = useState<Record<string, boolean>>({});
  const [ncmAlerts, setNcmAlerts] = useState<Record<string, string>>({});

  // Pagamento
  const [tPag, setTPag] = useState('90');
  const [vPag, setVPag] = useState(0);

  // Estado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const ncmTimer = useRef<Record<string, any>>({});

  useEffect(() => {
    api.get('/api/customers').then(setCustomers).catch(() => {});
    api.get('/api/products').then(setProducts).catch(() => {});
  }, []);

  // Consultar motor fiscal
  useEffect(() => {
    if (!operation || !purpose || !company) return;
    setLoadingFiscal(true);
    api.post('/api/fiscal-engine/query', {
      originUf: company.uf || 'SP',
      destinationUf: customerId
        ? customers.find(c => c.id === customerId)?.uf || company.uf || 'SP'
        : company.uf || 'SP',
      operation,
      purpose,
      taxRegime: company.taxRegime || 'simples_nacional',
    }).then(data => {
      setFiscalResult(data);
      // Preencher CFOP nos itens automaticamente
      if (data.cfop) {
        setItems(prev => prev.map(item => ({ ...item, cfop: data.cfop, csosn: data.cstCsosn || '102' })));
      }
    }).catch(() => setFiscalResult(null))
      .finally(() => setLoadingFiscal(false));
  }, [operation, purpose, customerId]);

  // Sugerir NCM por descrição
  const handleDescricaoChange = (itemId: string, descricao: string) => {
    updateItem(itemId, { xProd: descricao });
    if (ncmTimer.current[itemId]) clearTimeout(ncmTimer.current[itemId]);
    if (descricao.length < 3) return;
    ncmTimer.current[itemId] = setTimeout(async () => {
      try {
        const data = await api.get(`/api/ncm/suggest?descricao=${encodeURIComponent(descricao)}`);
        if (data?.ncm) {
          const item = items.find(i => i.id === itemId);
          if (!item?.ncm) {
            updateItem(itemId, { ncm: data.ncm, ncmSugerido: data.ncm });
          }
        }
      } catch {}
    }, 600);
  };

  // Verificar conflito de NCM
  const handleNcmChange = async (itemId: string, ncm: string) => {
    updateItem(itemId, { ncm });
    const item = items.find(i => i.id === itemId);
    if (!item || !item.xProd || ncm.length < 8) return;

    try {
      const data = await api.get(`/api/ncm/suggest?descricao=${encodeURIComponent(item.xProd)}`);
      if (data?.ncm && data.ncm !== ncm.replace(/\./g, '')) {
        setNcmAlerts(prev => ({
          ...prev,
          [itemId]: `NCM sugerida para "${item.xProd}" é ${data.ncm} (${data.descricao}). Deseja usar esta?`,
        }));
      } else {
        setNcmAlerts(prev => { const n = { ...prev }; delete n[itemId]; return n; });
      }
    } catch {}
  };

  const updateItem = (id: string, changes: Partial<Item>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...changes };
      updated.vProd = parseFloat((updated.qCom * updated.vUnCom).toFixed(2));
      return updated;
    }));
  };

  const selectProduct = (itemId: string, product: Product) => {
    updateItem(itemId, {
      productId: product.id,
      xProd: product.descricao,
      ncm: product.ncm,
      uCom: product.unidade,
      vUnCom: product.valorUnit,
    });
    setShowProductList(prev => ({ ...prev, [itemId]: false }));
    setProductSearch(prev => ({ ...prev, [itemId]: product.descricao }));
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerSearch(customer.nome);
    setShowCustomerList(false);
  };

  const vTotal = items.reduce((s, i) => s + i.vProd, 0);

  const handleSubmit = async () => {
    if (!fiscalResult?.cfop) { setError('Consulte o motor fiscal antes de emitir.'); return; }
    if (!company) { setError('Cadastre os dados da empresa primeiro.'); return; }
    if (items.some(i => !i.xProd || !i.ncm || !i.vUnCom)) { setError('Preencha todos os campos dos itens.'); return; }

    setError('');
    setLoading(true);
    try {
      const data = await api.post('/api/invoices', {
        customerId: customerId || undefined,
        tpNF,
        operation,
        purpose,
        natOp: fiscalResult.naturezaOperacao || 'Operação',
        cfop: fiscalResult.cfop,
        cstCsosn: fiscalResult.cstCsosn || '102',
        infCpl: fiscalResult.informacoesComplementares || '',
        ambiente: '2',
        vFrete: 0,
        vDesc: 0,
        modFrete: '9',
        tPag,
        vPag,
        items: items.map(i => ({
          productId: i.productId,
          xProd: i.xProd,
          ncm: i.ncm.replace(/\D/g, ''),
          cfop: i.cfop || fiscalResult.cfop,
          uCom: i.uCom,
          qCom: i.qCom,
          vUnCom: i.vUnCom,
          ean: 'SEM GTIN',
          origem: '0',
          csosn: i.csosn,
          saveProduct: i.saveProduct,
        })),
      });
      setSuccess(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadXml = async (id: string, numero: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/invoices/${id}/xml`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${numero}.xml`;
    a.click();
  };

  if (success) {
    return (
      <div>
        <div className="alert alert-success">
          ✅ NF-e nº {success.numero} gerada com sucesso!
        </div>
        <div className="card">
          <div className="card-title">Resumo</div>
          <div className="result-grid">
            <div className="result-item">
              <div className="result-label">Número</div>
              <div className="result-value">{success.numero}</div>
            </div>
            <div className="result-item">
              <div className="result-label">CFOP</div>
              <div className="result-value">{success.cfop}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Total</div>
              <div className="result-value small">R$ {success.vTotal?.toFixed(2).replace('.', ',')}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Status</div>
              <div className="result-value small text-warning">Gerada</div>
            </div>
          </div>
          {fiscalResult?.informacoesComplementares && (
            <div className="result-block">
              <div className="result-block-label">Informações Complementares</div>
              <div className="result-block-text">{fiscalResult.informacoesComplementares}</div>
            </div>
          )}
          <div className="alert alert-warning mt-8">
            ⚠️ Ambiente de homologação — NF sem valor fiscal
          </div>
          <button className="btn btn-primary mt-16" onClick={() => downloadXml(success.id, success.numero)}>
            📥 Baixar XML
          </button>
          <button className="btn btn-outline mt-8" onClick={() => { setSuccess(null); setItems([newItem()]); setOperation(''); setPurpose(''); setFiscalResult(null); setCustomerId(''); setCustomerSearch(''); }}>
            + Nova NF-e
          </button>
          <button className="btn btn-outline mt-8" onClick={onBack}>
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* TIPO DA NF */}
      <div className="card">
        <div className="card-title">Tipo da Nota</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: '1', l: '📤 Saída' }, { v: '0', l: '📥 Entrada' }].map(t => (
            <button
              key={t.v}
              className={`btn ${tpNF === t.v ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => setTpNF(t.v as '0' | '1')}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* DESTINATÁRIO */}
      <div className="card">
        <div className="card-title">Destinatário</div>
        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label">Buscar cliente</label>
          <input
            className="form-input"
            placeholder="Nome ou CPF/CNPJ..."
            value={customerSearch}
            onChange={e => {
              setCustomerSearch(e.target.value);
              setShowCustomerList(true);
              if (!e.target.value) setCustomerId('');
              api.get(`/api/customers?q=${e.target.value}`).then(setCustomers).catch(() => {});
            }}
          />
          {showCustomerList && customers.length > 0 && customerSearch && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 20, maxHeight: 200, overflowY: 'auto' }}>
              {customers.map(c => (
                <div key={c.id} onClick={() => selectCustomer(c)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                  <div style={{ fontWeight: 600 }}>{c.nome}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.cpfCnpj} — {c.uf}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {!customerId && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Sem destinatário selecionado — NF será emitida sem destinatário.
          </div>
        )}
      </div>

      {/* OPERAÇÃO */}
      <div className="card">
        <div className="card-title">Operação Fiscal</div>
        <div className="form-group">
          <label className="form-label">Tipo de Operação</label>
          <select className="form-select" value={operation} onChange={e => { setOperation(e.target.value); setPurpose(''); setFiscalResult(null); }}>
            <option value="">Selecione...</option>
            {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {operation && (
          <div className="form-group">
            <label className="form-label">Finalidade</label>
            <select className="form-select" value={purpose} onChange={e => setPurpose(e.target.value)}>
              <option value="">Selecione...</option>
              {(PURPOSES[operation] || []).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        )}

        {loadingFiscal && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>⏳ Consultando motor fiscal...</div>}

        {fiscalResult && fiscalResult.cfop && (
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>MOTOR FISCAL</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CFOP </span><strong style={{ color: 'var(--primary-light)' }}>{fiscalResult.cfop}</strong></div>
              <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CSOSN </span><strong style={{ color: 'var(--primary-light)' }}>{fiscalResult.cstCsosn}</strong></div>
              <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nat. Op. </span><strong>{fiscalResult.naturezaOperacao}</strong></div>
            </div>
            {fiscalResult.mensagemAlerta && (
              <div className="alert alert-warning mt-8" style={{ fontSize: 12 }}>⚠️ {fiscalResult.mensagemAlerta}</div>
            )}
          </div>
        )}
      </div>

      {/* ITENS */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>Itens da NF</div>
          <button className="btn btn-outline btn-sm" onClick={() => setItems(prev => [...prev, newItem()])}>+ Item</button>
        </div>

        {items.map((item, idx) => (
          <div key={item.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>ITEM {idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>✕</button>
              )}
            </div>

            {/* Busca de produto */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Produto / Serviço</label>
              <input
                className="form-input"
                placeholder="Digite para buscar ou criar..."
                value={productSearch[item.id] ?? item.xProd}
                onChange={e => {
                  setProductSearch(prev => ({ ...prev, [item.id]: e.target.value }));
                  setShowProductList(prev => ({ ...prev, [item.id]: true }));
                  handleDescricaoChange(item.id, e.target.value);
                  api.get(`/api/products?q=${e.target.value}`).then(setProducts).catch(() => {});
                }}
              />
              {showProductList[item.id] && products.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 20, maxHeight: 180, overflowY: 'auto' }}>
                  {products.map(p => (
                    <div key={p.id} onClick={() => selectProduct(item.id, p)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{p.descricao}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>NCM {p.ncm} · {p.unidade} · R$ {p.valorUnit.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NCM */}
            <div className="form-group">
              <label className="form-label">
                NCM
                {item.ncmSugerido && item.ncm === item.ncmSugerido && (
                  <span style={{ color: 'var(--success)', fontSize: 11, marginLeft: 6 }}>✓ sugerido automaticamente</span>
                )}
              </label>
              <input
                className="form-input"
                placeholder="00000000"
                value={item.ncm}
                onChange={e => handleNcmChange(item.id, e.target.value)}
              />
              {ncmAlerts[item.id] && (
                <div style={{ marginTop: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#fbbf24' }}>
                  ⚠️ {ncmAlerts[item.id]}
                  <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      const sugerida = ncmAlerts[item.id].match(/é (\d+)/)?.[1];
                      if (sugerida) updateItem(item.id, { ncm: sugerida });
                      setNcmAlerts(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                    }} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                      Usar sugerida
                    </button>
                    <button onClick={() => setNcmAlerts(prev => { const n = { ...prev }; delete n[item.id]; return n; })} style={{ background: 'var(--bg-input)', color: 'var(--text)', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                      Manter atual
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quantidade e Valor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="form-group">
                <label className="form-label">Un.</label>
                <select className="form-select" value={item.uCom} onChange={e => updateItem(item.id, { uCom: e.target.value })}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qtd</label>
                <input className="form-input" type="number" min="0.01" step="0.01" value={item.qCom} onChange={e => updateItem(item.id, { qCom: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Vl. Unit.</label>
                <input className="form-input" type="number" min="0.01" step="0.01" value={item.vUnCom} onChange={e => updateItem(item.id, { vUnCom: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total do item:</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-light)' }}>R$ {item.vProd.toFixed(2).replace('.', ',')}</span>
            </div>

            {!item.productId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={item.saveProduct} onChange={e => updateItem(item.id, { saveProduct: e.target.checked })} />
                Salvar produto no cadastro
              </label>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <span style={{ fontWeight: 600 }}>Total da NF</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-light)' }}>R$ {vTotal.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      {/* PAGAMENTO */}
      <div className="card">
        <div className="card-title">Pagamento</div>
        <div className="form-group">
          <label className="form-label">Forma de pagamento</label>
          <select className="form-select" value={tPag} onChange={e => setTPag(e.target.value)}>
            {FORMAS_PAG.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        {tPag !== '90' && (
          <div className="form-group">
            <label className="form-label">Valor pago</label>
            <input className="form-input" type="number" value={vPag} onChange={e => setVPag(parseFloat(e.target.value) || 0)} />
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="alert alert-warning" style={{ fontSize: 12 }}>
        ⚠️ NF será gerada em <strong>homologação</strong> (sem valor fiscal)
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={loading || !fiscalResult?.cfop || items.some(i => !i.xProd || !i.ncm)}
      >
        {loading ? 'Gerando...' : '📄 Gerar NF-e'}
      </button>

      <button className="btn btn-outline mt-8" onClick={onBack}>← Voltar</button>
    </div>
  );
}
