import { useState, useEffect } from 'react';
import { api } from '../api';
import type { User } from '../App';

type Props = {
  user: User;
  isFirstAccess?: boolean;
  onSaved: (company: any) => void;
};

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const CUF_MAP: Record<string, string> = {
  AC:'12',AL:'27',AM:'13',AP:'16',BA:'29',CE:'23',DF:'53',ES:'32',GO:'52',
  MA:'21',MG:'31',MS:'50',MT:'51',PA:'15',PB:'25',PE:'26',PI:'22',PR:'41',
  RJ:'33',RN:'24',RO:'11',RR:'14',RS:'43',SC:'42',SE:'28',SP:'35',TO:'17',
};

const formatCnpj = (v: string) =>
  v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');

const formatCep = (v: string) =>
  v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

export default function Company({ user, isFirstAccess, onSaved }: Props) {
  // Popup só aparece no primeiro acesso E se nunca emitiu NF pelo Snap Fisk
  const [showPopup, setShowPopup] = useState(isFirstAccess ?? false);
  const [jaEmitiu, setJaEmitiu] = useState<boolean | null>(null);

  // Dados da empresa
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState(user.cnpj || '');
  const [ie, setIe] = useState('');
  const [im, setIm] = useState('');
  const [uf, setUf] = useState('SP');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [xMun, setXMun] = useState('');
  const [cMun, setCMun] = useState('');
  const [fone, setFone] = useState('');
  const [email, setEmail] = useState(user.email || '');
  const [taxRegime, setTaxRegime] = useState('simples_nacional');
  const [serie, setSerie] = useState('0');
  const [proximaNF, setProximaNF] = useState(1);
  const [logo, setLogo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Se já emitiu alguma NF pelo Snap Fisk, não mostrar popup
    if (isFirstAccess) {
      api.get('/api/invoices').then((invoices: any[]) => {
        if (invoices && invoices.length > 0) {
          setShowPopup(false);
        }
      }).catch(() => {});
    }

    api.get('/api/company').then(c => {
      if (c) {
        setRazaoSocial(c.razaoSocial || '');
        setNomeFantasia(c.nomeFantasia || '');
        setCnpj(formatCnpj(c.cnpj || user.cnpj));
        setIe(c.ie || '');
        setIm(c.im || '');
        setUf(c.uf || 'SP');
        setCep(c.cep || '');
        setLogradouro(c.logradouro || '');
        setNumero(c.numero || '');
        setComplemento(c.complemento || '');
        setBairro(c.bairro || '');
        setXMun(c.xMun || '');
        setCMun(c.cMun || '');
        setFone(c.fone || '');
        setEmail(c.email || user.email || '');
        setTaxRegime(c.taxRegime || 'mei');
        setLogo(c.logo || '');
        setSerie(c.serie || '0');
        setProximaNF(c.proximaNF || 1);
      }
    }).catch(() => {
      setCnpj(formatCnpj(user.cnpj));
    });
  }, []);

  const buscarCnpj = async () => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return;
    setLoadingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRazaoSocial(data.razao_social || '');
      setNomeFantasia(data.nome_fantasia || '');
      setLogradouro(data.logradouro || '');
      setNumero(data.numero || '');
      setComplemento(data.complemento || '');
      setBairro(data.bairro || '');
      setXMun(data.municipio || '');
      setCMun(data.codigo_municipio_ibge?.toString() || '');
      setUf(data.uf || 'SP');
      setCep((data.cep || '').replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2'));
      setEmail(data.email || email);
      setFone(data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, '') : fone);
    } catch {
      setError('CNPJ não encontrado. Preencha os dados manualmente.');
    } finally {
      setLoadingCnpj(false);
    }
  };

  const buscarCep = async (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.erro) {
        setLogradouro(data.logradouro || '');
        setBairro(data.bairro || '');
        setXMun(data.localidade || '');
        setCMun(data.ibge || '');
        setUf(data.uf || 'SP');
      }
    } catch (e) {
      console.error('Erro ao buscar CEP:', e);
    }
  };

  const confirmarPopup = () => {
    if (jaEmitiu === null) return;
    if (jaEmitiu) {
      setSerie('3');
      setProximaNF(1);
    } else {
      setSerie('0');
      setProximaNF(1);
    }
    setShowPopup(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setError('Logo muito grande. Use uma imagem de até 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!razaoSocial || !cnpj || !uf) {
      setError('Razão Social, CNPJ e UF são obrigatórios.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const saved = await api.post('/api/company', {
        razaoSocial,
        nomeFantasia: nomeFantasia || undefined,
        cnpj: cnpj.replace(/\D/g, ''),
        ie: ie || undefined,
        im: im || undefined,
        uf,
        cuf: CUF_MAP[uf] || '35',
        cep: cep || undefined,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        bairro: bairro || undefined,
        xMun: xMun || undefined,
        cMun: cMun || undefined,
        fone: fone || undefined,
        email: email || undefined,
        taxRegime: 'mei',
        logo: logo || undefined,
        serie,
        proximaNF,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSaved(saved);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── POP-UP PRIMEIRO ACESSO ───────────────────────────────────────────────
  // Só aparece quando é o primeiro acesso E nunca emitiu NF pelo Snap Fisk

  if (showPopup) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Bem-vindo ao Snap Fisk!</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Antes de emitir sua primeira NF-e, precisamos saber:
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, textAlign: 'center' }}>
            Você já emitiu NF-e por outro sistema antes?
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <div
              onClick={() => setJaEmitiu(false)}
              style={{
                border: `2px solid ${jaEmitiu === false ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: 16,
                cursor: 'pointer',
                background: jaEmitiu === false ? 'rgba(99,102,241,0.1)' : 'var(--bg)',
              }}
            >
              <div style={{ fontWeight: 700 }}>🆕 Não — é minha primeira vez</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Vou começar a numeração do zero
              </div>
            </div>

            <div
              onClick={() => setJaEmitiu(true)}
              style={{
                border: `2px solid ${jaEmitiu === true ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: 16,
                cursor: 'pointer',
                background: jaEmitiu === true ? 'rgba(99,102,241,0.1)' : 'var(--bg)',
              }}
            >
              <div style={{ fontWeight: 700 }}>✅ Sim — já usei Sebrae ou outro emissor</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Vou usar a Série 3 para não conflitar
              </div>
            </div>
          </div>

          {jaEmitiu === true && (
            <div className="alert alert-warning" style={{ fontSize: 12, marginBottom: 16 }}>
              ⚠️ A Série 3 é nova e independente das suas NFs anteriores. Suas notas emitidas em outros sistemas continuam válidas normalmente.
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={confirmarPopup}
            disabled={jaEmitiu === null}
          >
            Continuar →
          </button>
        </div>
      </div>
    );
  }

  // ─── FORMULÁRIO DA EMPRESA ────────────────────────────────────────────────

  return (
    <div>
      <div className="card">
        <div className="card-title">Dados do Emitente</div>

        <div className="form-group">
          <label className="form-label">CNPJ</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              value={cnpj}
              onChange={e => setCnpj(formatCnpj(e.target.value))}
              onBlur={buscarCnpj}
              placeholder="00.000.000/0000-00"
            />
            <button className="btn btn-outline btn-sm" onClick={buscarCnpj} disabled={loadingCnpj} style={{ whiteSpace: 'nowrap' }}>
              {loadingCnpj ? '...' : '🔍 Buscar'}
            </button>
          </div>
          {loadingCnpj && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Buscando na Receita Federal...</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Razão Social</label>
          <input className="form-input" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Nome Fantasia (opcional)</label>
          <input className="form-input" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>IE <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(Inscrição Estadual)</span></label>
            <a href="https://www.sintegra.gov.br" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--primary-light)' }}>Consultar Sintegra →</a>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input className="form-input" value={ie} onChange={e => setIe(e.target.value)} placeholder="IE ou ISENTO" />
            <button className="btn btn-outline btn-sm" onClick={() => setIe('ISENTO')} style={{ whiteSpace: 'nowrap' }}>Isento</button>
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>IM <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(Inscrição Municipal)</span></label>
            {uf === 'SP' && (
              <a href="https://ccm.prefeitura.sp.gov.br" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--primary-light)' }}>Consultar CCM SP →</a>
            )}
          </div>
          <input className="form-input" style={{ marginTop: 6 }} value={im} onChange={e => setIm(e.target.value)} placeholder="Nº da Inscrição Municipal" />
        </div>

        <div className="form-group">
          <label className="form-label">Logo da Empresa (opcional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
            <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--bg)', flexShrink: 0 }}>
              {logo ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 28 }}>🏢</span>}
            </div>
            <div>
              <label htmlFor="logo-upload" style={{ display: 'inline-block', padding: '8px 16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                📷 {logo ? 'Trocar logo' : 'Carregar logo'}
              </label>
              <input id="logo-upload" type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: 'none' }} onChange={handleLogoUpload} />
              {logo && (
                <button onClick={() => setLogo('')} style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>
                  ✕ Remover logo
                </button>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>PNG, JPG ou SVG · Máx. 500KB</div>
            </div>
          </div>
        </div>
      </div>

      {/* ENDEREÇO */}
      <div className="card">
        <div className="card-title">Endereço</div>

        <div className="form-group">
          <label className="form-label">CEP</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              placeholder="00000-000"
              value={cep}
              onChange={e => { const f = formatCep(e.target.value); setCep(f); if (f.replace(/\D/g, '').length === 8) buscarCep(f); }}
              onBlur={() => buscarCep(cep)}
            />
            <button className="btn btn-outline btn-sm" onClick={() => buscarCep(cep)} style={{ whiteSpace: 'nowrap' }} type="button">🔍 Buscar</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Logradouro</label>
            <input className="form-input" value={logradouro} onChange={e => setLogradouro(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nº</label>
            <input className="form-input" value={numero} onChange={e => setNumero(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Complemento (opcional)</label>
          <input className="form-input" placeholder="Sala, Andar, Bloco..." value={complemento} onChange={e => setComplemento(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Bairro</label>
          <input className="form-input" value={bairro} onChange={e => setBairro(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Município</label>
            <input className="form-input" value={xMun} onChange={e => setXMun(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">UF</label>
            <select className="form-select" value={uf} onChange={e => setUf(e.target.value)}>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* CONTATO */}
      <div className="card">
        <div className="card-title">Contato</div>
        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Telefone</label>
          <input className="form-input" value={fone} onChange={e => setFone(e.target.value)} placeholder="11999999999" />
        </div>
      </div>

      {/* CONFIGURAÇÕES FISCAIS */}
      <div className="card">
        <div className="card-title">Configurações Fiscais</div>

        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
          ⚠️ <strong>Atenção:</strong> A numeração da NF-e é controlada pela SEFAZ. Se você já emitiu NFs por outro sistema, use uma série diferente para evitar rejeição.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Série</label>
            <select className="form-select" value={serie} onChange={e => setSerie(e.target.value)}>
              <option value="0">0 — Padrão</option>
              <option value="1">1 — Saída</option>
              <option value="2">2 — Entrada/Específica</option>
              <option value="3">3 — Migração de outro sistema</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Próximo Nº NF</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={proximaNF}
              onChange={e => setProximaNF(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Série atual: <strong>{serie}</strong> · Próxima NF: <strong>#{proximaNF}</strong>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">✅ Dados salvos com sucesso!</div>}

      <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
        {loading ? 'Salvando...' : '💾 Salvar dados da empresa'}
      </button>
    </div>
  );
}
