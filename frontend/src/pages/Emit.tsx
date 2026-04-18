import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import type { User } from '../App';
import Danfe from './Danfe';

type Customer = {
  id: string;
  tipoPessoa: string;
  cpfCnpj: string;
  nome: string;
  ie?: string;
  uf?: string;
  xMun?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cMun?: string;
  email?: string;
  fone?: string;
};

type Product = {
  id: string;
  codigo?: string;
  descricao: string;
  ncm: string;
  unidade: string;
  valorUnit: number;
};

type Item = {
  id: string;
  productId?: string;
  cProd?: string;
  xProd: string;
  ncm: string;
  ncmSugerido?: string;
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

type NewCustomer = {
  tipoPessoa: 'PF' | 'PJ';
  cpfCnpj: string;
  nome: string;
  ie: string;
  indIEDest: string;
  email: string;
  fone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  xMun: string;
  cMun: string;
  uf: string;
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

const UNIDADES = ['PC', 'UN', 'KG', 'MT', 'LT', 'CX', 'PAR', 'JG', 'SC', 'M2'];

const FORMAS_PAG = [
  { value: '90', label: 'Sem pagamento' },
  { value: '01', label: 'Dinheiro' },
  { value: '03', label: 'Cartão de crédito' },
  { value: '04', label: 'Cartão de débito' },
  { value: '15', label: 'Boleto' },
  { value: '17', label: 'PIX' },
];

const MOD_FRETE = [
  { value: '9', label: 'Sem frete' },
  { value: '0', label: 'Por conta do emitente (CIF)' },
  { value: '1', label: 'Por conta do destinatário (FOB)' },
  { value: '2', label: 'Por conta de terceiros' },
];

const emptyCustomer = (): NewCustomer => ({
  tipoPessoa: 'PF',
  cpfCnpj: '',
  nome: '',
  ie: '',
  indIEDest: '9',
  email: '',
  fone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  xMun: '',
  cMun: '',
  uf: '',
});

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

const formatCpf = (v: string) =>
  v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const formatCnpj = (v: string) =>
  v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');

const formatCep = (v: string) =>
  v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

type Props = { user: User; fiscalContext?: import('../App').FiscalContext | null; onBack: () => void };

export default function Emit({ user, fiscalContext, onBack }: Props) {
  const company = user.company;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCust, setNewCust] = useState<NewCustomer>(emptyCustomer());
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [tpNF, setTpNF] = useState<'0' | '1'>('1');
  const [operation, setOperation] = useState(fiscalContext?.operation ?? '');
  const [purpose, setPurpose] = useState(fiscalContext?.purpose ?? '');
  const [fiscalResult, setFiscalResult] = useState<FiscalResult | null>(
    fiscalContext?.cfop ? {
      cfop: fiscalContext.cfop,
      cstCsosn: fiscalContext.cstCsosn,
      naturezaOperacao: fiscalContext.naturezaOperacao,
      informacoesComplementares: fiscalContext.informacoesComplementares,
      mensagemAlerta: fiscalContext.mensagemAlerta,
    } : null
  );
  const [loadingFiscal, setLoadingFiscal] = useState(false);

  const [items, setItems] = useState<Item[]>([newItem()]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [showProductList, setShowProductList] = useState<Record<string, boolean>>({});
  const [ncmAlerts, setNcmAlerts] = useState<Record<string, string>>({});
  const [ncmSearch, setNcmSearch] = useState<Record<string, string>>({});
  const [ncmResults, setNcmResults] = useState<Record<string, any[]>>({});
  const [showNcmSearch, setShowNcmSearch] = useState<Record<string, boolean>>({});
  const ncmSearchTimer = useRef<Record<string, any>>({});

  // ─── FRETE E DESCONTO ────────────────────────────────────────────────────
  const [modFrete, setModFrete] = useState('9');
  const [vFrete, setVFrete] = useState(0);
  const [vDesc, setVDesc] = useState(0);

  const [tPag, setTPag] = useState('90');
  const [vPag, setVPag] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [showDanfe, setShowDanfe] = useState(false);
  const ncmTimer = useRef<Record<string, any>>({});

  useEffect(() => {
    api.get('/api/customers').then(setCustomers).catch(() => {});
    api.get('/api/products').then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!operation || !purpose || !company) return;
    setLoadingFiscal(true);
    api.post('/api/fiscal-engine/query', {
      originUf: company.uf || 'SP',
      destinationUf: selectedCustomer?.uf || company.uf || 'SP',
      operation,
      purpose,
      taxRegime: company.taxRegime || 'simples_nacional',
    }).then(data => {
      setFiscalResult(data);
      if (data.cfop) {
        setItems(prev => prev.map(i => ({ ...i, cfop: data.cfop, csosn: data.cstCsosn || '102' })));
      }
    }).catch(() => setFiscalResult(null))
      .finally(() => setLoadingFiscal(false));
  }, [operation, purpose, selectedCustomer]);

  // ─── BUSCA CNPJ ────────────────────────────────────────────────────────────

  const buscarCnpj = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return;
    setLoadingCnpj(true);
    setCnpjError('');
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const data = await res.json();
      setNewCust(prev => ({
        ...prev,
        tipoPessoa: 'PJ',
        cpfCnpj: cnpj,
        nome: data.razao_social || data.nome_fantasia || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        xMun: data.municipio || '',
        cMun: data.codigo_municipio_ibge?.toString() || '',
        uf: data.uf || '',
        cep: (data.cep || '').replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2'),
        email: data.email || '',
        fone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, '') : '',
        indIEDest: '1',
        ie: '',
      }));
    } catch {
      setCnpjError('CNPJ não encontrado na Receita Federal. Preencha manualmente.');
    } finally {
      setLoadingCnpj(false);
    }
  };

  // ─── BUSCA CEP ─────────────────────────────────────────────────────────────

  const buscarCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setNewCust(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          xMun: data.localidade || prev.xMun,
          cMun: data.ibge || prev.cMun,
          uf: data.uf || prev.uf,
        }));
      }
    } catch {}
  };

  // ─── SALVAR CLIENTE ────────────────────────────────────────────────────────

  const handleSaveCustomer = async () => {
    const docClean = newCust.cpfCnpj.replace(/\D/g, '');
    if (!docClean || (docClean.length !== 11 && docClean.length !== 14)) {
      setCnpjError('CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.');
      return;
    }
    if (!newCust.nome) {
      setCnpjError('Nome é obrigatório.');
      return;
    }
    setSavingCustomer(true);
    setCnpjError('');
    try {
      const saved = await api.post('/api/customers', {
        ...newCust,
        cpfCnpj: docClean,
        ie: newCust.ie || undefined,
        complemento: newCust.complemento || undefined,
        email: newCust.email || undefined,
      });
      setCustomers(prev => [saved, ...prev]);
      setSelectedCustomer(saved);
      setCustomerId(saved.id);
      setCustomerSearch(saved.nome);
      setShowNewCustomer(false);
      setNewCust(emptyCustomer());
    } catch (e: any) {
      setCnpjError(e.message);
    } finally {
      setSavingCustomer(false);
    }
  };

  const selectCustomer = (c: Customer) => {
    setCustomerId(c.id);
    setSelectedCustomer(c);
    setCustomerSearch(c.nome);
    setShowCustomerList(false);
    setShowNewCustomer(false);
  };

  // ─── PRODUTOS ──────────────────────────────────────────────────────────────

  const handleDescricaoChange = (itemId: string, descricao: string) => {
    updateItem(itemId, { xProd: descricao, ncm: '', ncmSugerido: undefined });
    if (ncmTimer.current[itemId]) clearTimeout(ncmTimer.current[itemId]);
    if (descricao.length < 3) return;
    ncmTimer.current[itemId] = setTimeout(async () => {
      try {
        const data = await api.get(`/api/ncm/ai-suggest?descricao=${encodeURIComponent(descricao)}`);
        if (data?.ncm) {
          updateItem(itemId, { ncm: data.ncm, ncmSugerido: data.ncm });
          return;
        }
        const local = await api.get(`/api/ncm/suggest?descricao=${encodeURIComponent(descricao)}`);
        if (local?.ncm) {
          updateItem(itemId, { ncm: local.ncm, ncmSugerido: local.ncm });
        }
      } catch {}
    }, 800);
  };

  const handleNcmSearch = (itemId: string, termo: string) => {
    setNcmSearch(prev => ({ ...prev, [itemId]: termo }));
    if (ncmSearchTimer.current[itemId]) clearTimeout(ncmSearchTimer.current[itemId]);
    if (termo.length < 2) { setNcmResults(prev => ({ ...prev, [itemId]: [] })); return; }
    ncmSearchTimer.current[itemId] = setTimeout(async () => {
      try {
        const results = await api.get(`/api/ncm/search?q=${encodeURIComponent(termo)}`);
        setNcmResults(prev => ({ ...prev, [itemId]: results }));
      } catch {}
    }, 400);
  };

  const selectNcm = (itemId: string, codigo: string) => {
    updateItem(itemId, { ncm: codigo });
    setShowNcmSearch(prev => ({ ...prev, [itemId]: false }));
    setNcmResults(prev => ({ ...prev, [itemId]: [] }));
    setNcmAlerts(prev => { const n = { ...prev }; delete n[itemId]; return n; });
  };

  const handleNcmChange = async (itemId: string, ncm: string) => {
    updateItem(itemId, { ncm });
    const item = items.find(i => i.id === itemId);
    if (!item || !item.xProd || ncm.replace(/\D/g, '').length < 8) return;
    try {
      const data = await api.get(`/api/ncm/suggest?descricao=${encodeURIComponent(item.xProd)}`);
      if (data?.ncm && data.ncm !== ncm.replace(/\D/g, '')) {
        setNcmAlerts(prev => ({ ...prev, [itemId]: `NCM sugerida para "${item.xProd}": ${data.ncm} — ${data.descricao}` }));
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
      cProd: product.codigo || undefined,
      xProd: product.descricao,
      ncm: product.ncm,
      uCom: product.unidade,
      vUnCom: product.valorUnit,
    });
    setShowProductList(prev => ({ ...prev, [itemId]: false }));
    setProductSearch(prev => ({ ...prev, [itemId]: product.descricao }));
  };

  const vTotalItens = items.reduce((s, i) => s + i.vProd, 0);
  const vTotal = vTotalItens + vFrete - vDesc;

  // ─── COMPARTILHAR ──────────────────────────────────────────────────────────

  const handleShare = async (invoice: any) => {
    const text = `📄 *NF-e Snap Fisk*
Nº: ${invoice.numero} | Série: ${invoice.serie}
CFOP: ${invoice.cfop} | Total: R$ ${invoice.vTotal?.toFixed(2).replace('.', ',')}
${selectedCustomer ? `Destinatário: ${selectedCustomer.nome}` : ''}
${fiscalResult?.naturezaOperacao ? `Operação: ${fiscalResult.naturezaOperacao}` : ''}
Status: Gerada (homologação)
_Emitida pelo Snap Fisk — snapfisk.com.br_`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `NF-e nº ${invoice.numero}`, text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      alert('Resumo copiado! Cole no WhatsApp ou e-mail.');
    }
  };

  // ─── EMITIR NF ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!fiscalResult?.cfop) { setError('Selecione a operação para o motor fiscal preencher os campos.'); return; }
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
        vFrete,
        vDesc,
        modFrete,
        tPag,
        vPag,
        items: items.map(i => ({
          productId: i.productId,
          cProd: i.cProd,
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
    const res = await fetch(`/api/invoices/${id}/xml`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${numero}.xml`;
    a.click();
  };

  // ─── TELA DE SUCESSO ───────────────────────────────────────────────────────

  if (success) {
    // Monta objeto enriquecido para o DANFE
    const invoiceParaDanfe = {
      ...success,
      customer: selectedCustomer,
      vFrete,
      vDesc,
      modFrete,
      tPag,
      vPag,
      infCpl: fiscalResult?.informacoesComplementares || '',
    };

    return (
      <div>
        {/* Visualizador DANFE em overlay */}
        {showDanfe && (
          <Danfe
            invoice={invoiceParaDanfe}
            company={company}
            onClose={() => setShowDanfe(false)}
          />
        )}

        <div className="alert alert-success">✅ NF-e nº {success.numero} gerada com sucesso!</div>
        <div className="card">
          <div className="card-title">Resumo da NF-e</div>
          <div className="result-grid">
            <div className="result-item"><div className="result-label">Número</div><div className="result-value">{success.numero}</div></div>
            <div className="result-item"><div className="result-label">CFOP</div><div className="result-value">{success.cfop}</div></div>
            <div className="result-item"><div className="result-label">Total</div><div className="result-value small">R$ {success.vTotal?.toFixed(2).replace('.', ',')}</div></div>
            <div className="result-item"><div className="result-label">Status</div><div className="result-value small text-warning">Gerada</div></div>
          </div>

          {fiscalResult?.naturezaOperacao && (
            <div className="result-block">
              <div className="result-block-label">Natureza da Operação</div>
              <div className="result-block-text fw-700">{fiscalResult.naturezaOperacao}</div>
            </div>
          )}

          {selectedCustomer && (
            <div className="result-block">
              <div className="result-block-label">Destinatário</div>
              <div className="result-block-text">{selectedCustomer.nome} — {selectedCustomer.cpfCnpj}</div>
            </div>
          )}

          <div className="alert alert-warning mt-8">⚠️ Ambiente de homologação — NF sem valor fiscal</div>

          {/* Botões de ação */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowDanfe(true)}>
              📋 Ver DANFE
            </button>
            <button className="btn btn-primary" onClick={() => downloadXml(success.id, success.numero)}>
              📥 Baixar XML
            </button>
            <button
              className="btn btn-outline"
              onClick={() => handleShare(success)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              📤 Compartilhar
            </button>
          </div>

          <button className="btn btn-outline mt-8" onClick={() => {
            setSuccess(null);
            setItems([newItem()]);
            setOperation('');
            setPurpose('');
            setFiscalResult(null);
            setCustomerId('');
            setCustomerSearch('');
            setSelectedCustomer(null);
            setVFrete(0);
            setVDesc(0);
            setModFrete('9');
          }}>
            + Nova NF-e
          </button>
          <button className="btn btn-outline mt-8" onClick={onBack}>← Voltar</button>
        </div>
      </div>
    );
  }

  // ─── FORMULÁRIO ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* TIPO DA NF */}
      <div className="card">
        <div className="card-title">Tipo da Nota</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: '1', l: '📤 Saída' }, { v: '0', l: '📥 Entrada' }].map(t => (
            <button key={t.v} className={`btn ${tpNF === t.v ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setTpNF(t.v as '0' | '1')}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* DESTINATÁRIO */}
      <div className="card">
        <div className="card-title">Destinatário</div>

        {selectedCustomer ? (
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{selectedCustomer.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selectedCustomer.cpfCnpj}</div>
                {selectedCustomer.uf && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedCustomer.xMun} — {selectedCustomer.uf}</div>}
                {selectedCustomer.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>✉️ {selectedCustomer.email}</div>}
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerId(''); setCustomerSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 }}>✕ Trocar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Buscar cliente cadastrado</label>
              <input
                className="form-input"
                placeholder="Nome ou CPF/CNPJ..."
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerList(true);
                  api.get(`/api/customers?q=${e.target.value}`).then(setCustomers).catch(() => {});
                }}
                onFocus={() => setShowCustomerList(true)}
              />
              {showCustomerList && customers.length > 0 && (
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

            <button className="btn btn-outline mt-8" onClick={() => { setShowNewCustomer(!showNewCustomer); setShowCustomerList(false); }}>
              {showNewCustomer ? '✕ Cancelar' : '+ Novo cliente'}
            </button>

            {showNewCustomer && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Cadastrar novo cliente</div>

                <div className="form-group">
                  <label className="form-label">Tipo de Pessoa</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: 'PF', l: 'Pessoa Física' }, { v: 'PJ', l: 'Pessoa Jurídica' }].map(t => (
                      <button key={t.v} className={`btn ${newCust.tipoPessoa === t.v ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setNewCust(prev => ({ ...prev, tipoPessoa: t.v as 'PF' | 'PJ', cpfCnpj: '' }))}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{newCust.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      placeholder={newCust.tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                      value={newCust.cpfCnpj}
                      onChange={e => {
                        const formatted = newCust.tipoPessoa === 'PF' ? formatCpf(e.target.value) : formatCnpj(e.target.value);
                        setNewCust(prev => ({ ...prev, cpfCnpj: formatted }));
                        setCnpjError('');
                      }}
                      onBlur={() => { if (newCust.tipoPessoa === 'PJ') buscarCnpj(newCust.cpfCnpj); }}
                    />
                    {newCust.tipoPessoa === 'PJ' && (
                      <button className="btn btn-outline btn-sm" onClick={() => buscarCnpj(newCust.cpfCnpj)} disabled={loadingCnpj} style={{ whiteSpace: 'nowrap' }}>
                        {loadingCnpj ? '...' : '🔍 Buscar'}
                      </button>
                    )}
                  </div>
                  {loadingCnpj && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Buscando na Receita Federal...</div>}
                  {cnpjError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{cnpjError}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">{newCust.tipoPessoa === 'PF' ? 'Nome completo' : 'Razão Social'}</label>
                  <input className="form-input" value={newCust.nome} onChange={e => setNewCust(prev => ({ ...prev, nome: e.target.value }))} />
                </div>

                {newCust.tipoPessoa === 'PJ' && (
                  <div className="form-group">
                    <label className="form-label">Inscrição Estadual</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" placeholder="IE ou ISENTO" value={newCust.ie} onChange={e => setNewCust(prev => ({ ...prev, ie: e.target.value, indIEDest: !e.target.value || e.target.value === 'ISENTO' ? '2' : '1' }))} />
                      <button className="btn btn-outline btn-sm" onClick={() => setNewCust(prev => ({ ...prev, ie: 'ISENTO', indIEDest: '2' }))} style={{ whiteSpace: 'nowrap' }}>Isento</button>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">CEP</label>
                  <input className="form-input" placeholder="00000-000" value={newCust.cep} onChange={e => { const f = formatCep(e.target.value); setNewCust(prev => ({ ...prev, cep: f })); }} onBlur={() => buscarCep(newCust.cep)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Logradouro</label>
                    <input className="form-input" value={newCust.logradouro} onChange={e => setNewCust(prev => ({ ...prev, logradouro: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nº</label>
                    <input className="form-input" value={newCust.numero} onChange={e => setNewCust(prev => ({ ...prev, numero: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Complemento (opcional)</label>
                  <input className="form-input" placeholder="Apto, Sala, Bloco..." value={newCust.complemento} onChange={e => setNewCust(prev => ({ ...prev, complemento: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Bairro</label>
                  <input className="form-input" value={newCust.bairro} onChange={e => setNewCust(prev => ({ ...prev, bairro: e.target.value }))} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Município</label>
                    <input className="form-input" value={newCust.xMun} onChange={e => setNewCust(prev => ({ ...prev, xMun: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">UF</label>
                    <input className="form-input" maxLength={2} value={newCust.uf} onChange={e => setNewCust(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">E-mail <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(Envio do XML)</span></label>
                  <input className="form-input" type="email" placeholder="cliente@email.com" value={newCust.email} onChange={e => setNewCust(prev => ({ ...prev, email: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefone (opcional)</label>
                  <input className="form-input" value={newCust.fone} onChange={e => setNewCust(prev => ({ ...prev, fone: e.target.value }))} />
                </div>

                <button className="btn btn-primary" onClick={handleSaveCustomer} disabled={savingCustomer}>
                  {savingCustomer ? 'Salvando...' : '✅ Salvar cliente'}
                </button>
              </div>
            )}

            {!selectedCustomer && !showNewCustomer && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Sem destinatário — NF será emitida sem destinatário.
              </div>
            )}
          </>
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

        {fiscalResult?.cfop && (
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>✅ MOTOR FISCAL</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CFOP </span><strong style={{ color: 'var(--primary-light)', fontSize: 18 }}>{fiscalResult.cfop}</strong></div>
              <div><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CSOSN </span><strong style={{ color: 'var(--primary-light)' }}>{fiscalResult.cstCsosn}</strong></div>
              <div style={{ fontSize: 13 }}>{fiscalResult.naturezaOperacao}</div>
            </div>
            {fiscalResult.mensagemAlerta && <div className="alert alert-warning mt-8" style={{ fontSize: 12 }}>⚠️ {fiscalResult.mensagemAlerta}</div>}
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

            {/* Código do produto */}
            <div className="form-group">
              <label className="form-label">Código do item <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(opcional)</span></label>
              <input
                className="form-input"
                placeholder="Ex: 001, SKU-123..."
                value={item.cProd ?? ''}
                onChange={e => updateItem(item.id, { cProd: e.target.value })}
              />
            </div>

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
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {p.codigo ? `Cód: ${p.codigo} · ` : ''}NCM {p.ncm} · {p.unidade} · R$ {p.valorUnit.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  NCM
                  {item.xProd.length >= 3 && !item.ncm && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>⏳ buscando...</span>
                  )}
                  {item.ncmSugerido && item.ncm === item.ncmSugerido && (
                    <span style={{ color: 'var(--success)', fontSize: 11, marginLeft: 6 }}>✅ sugerido pela IA</span>
                  )}
                </label>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--primary-light)', fontSize: 12, cursor: 'pointer' }}
                  onClick={() => setShowNcmSearch(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                >
                  {showNcmSearch[item.id] ? '✕ Fechar busca' : '🔍 Buscar NCM'}
                </button>
              </div>
              <input className="form-input" placeholder="00000000" value={item.ncm} onChange={e => handleNcmChange(item.id, e.target.value)} />

              {showNcmSearch[item.id] && (
                <div style={{ marginTop: 8, background: 'var(--bg-card)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
                  <input
                    className="form-input"
                    placeholder="Digite descrição ou código NCM..."
                    value={ncmSearch[item.id] ?? ''}
                    onChange={e => handleNcmSearch(item.id, e.target.value)}
                    style={{ marginBottom: 8 }}
                    autoFocus
                  />
                  {ncmResults[item.id]?.length > 0 && (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {ncmResults[item.id].map((r: any) => (
                        <div
                          key={r.codigo}
                          onClick={() => selectNcm(item.id, r.codigo)}
                          style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{r.codigo}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{r.descricao}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ncmSearch[item.id]?.length >= 2 && ncmResults[item.id]?.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>
                      Nenhum resultado. Tente outros termos.
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Fonte: Tabela NCM Vigente — Resolução Gecex 812/2025
                  </div>
                </div>
              )}
              {ncmAlerts[item.id] && (
                <div style={{ marginTop: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#fbbf24' }}>
                  ⚠️ {ncmAlerts[item.id]}
                  <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      const match = ncmAlerts[item.id].match(/:\s*(\d+)/);
                      if (match) updateItem(item.id, { ncm: match[1] });
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="form-group">
                <label className="form-label">Un.</label>
                <select className="form-select" value={item.uCom} onChange={e => updateItem(item.id, { uCom: e.target.value })}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qtd</label>
                <input
                  className="form-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="1"
                  value={item.qCom === 0 ? '' : item.qCom}
                  onChange={e => updateItem(item.id, { qCom: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vl. Unit.</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={item.vUnCom === 0 ? '' : item.vUnCom.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const value = raw ? parseFloat(raw) / 100 : 0;
                    updateItem(item.id, { vUnCom: value });
                  }}
                />
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

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 600 }}>Subtotal dos itens</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-light)' }}>R$ {vTotalItens.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      {/* FRETE E DESCONTO */}
      <div className="card">
        <div className="card-title">Frete e Desconto</div>

        <div className="form-group">
          <label className="form-label">Modalidade do Frete</label>
          <select className="form-select" value={modFrete} onChange={e => { setModFrete(e.target.value); if (e.target.value === '9') setVFrete(0); }}>
            {MOD_FRETE.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {modFrete !== '9' && (
          <div className="form-group">
            <label className="form-label">Valor do Frete (R$)</label>
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={vFrete === 0 ? '' : vFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setVFrete(raw ? parseFloat(raw) / 100 : 0);
              }}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Desconto (R$)</label>
          <input
            className="form-input"
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={vDesc === 0 ? '' : vDesc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            onChange={e => {
              const raw = e.target.value.replace(/\D/g, '');
              setVDesc(raw ? parseFloat(raw) / 100 : 0);
            }}
          />
        </div>

        {/* Resumo total */}
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>
            <span>Subtotal</span><span>R$ {vTotalItens.toFixed(2).replace('.', ',')}</span>
          </div>
          {vFrete > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>
              <span>+ Frete</span><span>R$ {vFrete.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          {vDesc > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>
              <span>− Desconto</span><span>R$ {vDesc.toFixed(2).replace('.', ',')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700 }}>Total da NF</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-light)' }}>R$ {vTotal.toFixed(2).replace('.', ',')}</span>
          </div>
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
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={vPag === 0 ? '' : vPag.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setVPag(raw ? parseFloat(raw) / 100 : 0);
              }}
            />
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="alert alert-warning" style={{ fontSize: 12 }}>
        ⚠️ NF será gerada em <strong>homologação</strong> (sem valor fiscal)
      </div>

      <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !fiscalResult?.cfop || items.some(i => !i.xProd || !i.ncm)}>
        {loading ? 'Gerando...' : '📄 Gerar NF-e'}
      </button>

      <button className="btn btn-outline mt-8" onClick={onBack}>← Voltar</button>
    </div>
  );
}
