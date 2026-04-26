import { useState, useEffect } from 'react';
import { api } from '../api';
import type { User } from '../App';

type Invoice = {
  id: string; numero: number; serie: string; natOp: string; cfop: string;
  chaveAcesso?: string; dhEmi: string; vTotal: number; tpNF: string;
  finNFe?: string; status: string;
  customer?: { nome: string; cpfCnpj: string };
  items?: any[];
};

const CAMPOS_PROIBIDOS_CCE = [
  'valor','preço','base de cálculo','alíquota','icms','ipi','quantidade',
  'cfop','cst','csosn','cnpj','cpf','destinatário','remetente','emitente',
  'data de emissão','data saída','série','numero','número',
];

const TIPO_CORRECAO = [
  { id:'complementar', icon:'📄', titulo:'NF Complementar', subtitulo:'Diferença de preço ou quantidade a menor',
    descricao:'Emita quando o valor ou quantidade foi menor que o correto. finNFe=2.',
    cor:'rgba(99,102,241,0.15)', borda:'rgba(99,102,241,0.4)',
    badge:'RICMS-SP art. 182', prazo:'Dentro do período de apuração: sem prazo especial.' },
  { id:'reajuste', icon:'💰', titulo:'Reajuste de Preço', subtitulo:'Aumento de preço por contrato ou acordo',
    descricao:'Para reajustes contratuais. Prazo: 3 dias após o reajuste. Mesmo CFOP da original.',
    cor:'rgba(16,185,129,0.12)', borda:'rgba(16,185,129,0.35)',
    badge:'RICMS-SP art. 182 §1º', prazo:'3 dias após o reajuste de preço.' },
  { id:'cce', icon:'✏️', titulo:'Carta de Correção (CC-e)', subtitulo:'Erros que não afetam valores ou impostos',
    descricao:'Corrige dados que não impactam CFOP, alíquota, valor, base ou dados cadastrais principais.',
    cor:'rgba(245,158,11,0.12)', borda:'rgba(245,158,11,0.35)',
    badge:'Ajuste SINIEF 7/2005', prazo:'Até 720 horas (30 dias) após emissão.' },
  { id:'sinief13', icon:'🔄', titulo:'Devolução Simbólica', subtitulo:'Erro grave — anular e reemitir (Ajuste SINIEF 13/2024)',
    descricao:'Quando não é possível usar NF Complementar ou CC-e. Gera devolução simbólica + nova NF corrigida.',
    cor:'rgba(239,68,68,0.1)', borda:'rgba(239,68,68,0.35)',
    badge:'SINIEF 13/2024', prazo:'Até 168 horas (7 dias) após a entrega.' },
];

const CAMPOS_CCE = [
  { campo:'Valor da operação / base de cálculo', ok:false },
  { campo:'Alíquota de ICMS / IPI', ok:false },
  { campo:'Quantidade de mercadoria', ok:false },
  { campo:'CFOP', ok:false },
  { campo:'CST / CSOSN', ok:false },
  { campo:'CNPJ / CPF do emitente ou destinatário', ok:false },
  { campo:'Data de emissão ou saída', ok:false },
  { campo:'Número e série da NF-e', ok:false },
  { campo:'Razão social (sem alterar identidade)', ok:true },
  { campo:'Endereço (sem alterar UF ou município)', ok:true },
  { campo:'Dados de frete e transportadora', ok:true },
  { campo:'Observações / informações complementares', ok:true },
];

type Props = { user: User; onBack: () => void };

export default function Correct({ user, onBack }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [tipoCorrecao, setTipoCorrecao] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [step, setStep] = useState<'select-nf'|'select-tipo'|'form'>('select-nf');
  const [diffVlr, setDiffVlr] = useState(0);
  const [diffQtd, setDiffQtd] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [infCpl, setInfCpl] = useState('');
  const [xCorrecao, setXCorrecao] = useState('');
  const [cceWarning, setCceWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
    api.get('/api/invoices?status=EMITIDA&limit=50')
      .then(data => setInvoices(Array.isArray(data) ? data : data.invoices || []))
      .catch(() => {});
  }, []);

  const filtered = invoices.filter(inv => {
    const q = searchQ.toLowerCase();
    return !q || inv.numero.toString().includes(q) || inv.natOp.toLowerCase().includes(q) || (inv.customer?.nome||'').toLowerCase().includes(q);
  });

  const handleSelectInvoice = (inv: Invoice) => { setSelectedInvoice(inv); setTipoCorrecao(''); setError(''); setStep('select-tipo'); };

  const handleSelectTipo = (tipo: string) => {
    setTipoCorrecao(tipo);
    if (tipo === 'complementar' || tipo === 'reajuste') {
      const d = new Date(selectedInvoice!.dhEmi);
      const ds = d.toLocaleDateString('pt-BR');
      setInfCpl(`NF ${tipo==='reajuste'?'de reajuste de preço':'complementar'} ref. NF nº ${selectedInvoice!.numero}, série ${selectedInvoice!.serie}, de ${ds}, no valor de R$ ${selectedInvoice!.vTotal.toFixed(2).replace('.',',')}.`);
    }
    setStep('form');
  };

  const checkCce = (text: string) => {
    setXCorrecao(text);
    const lower = text.toLowerCase();
    const found = CAMPOS_PROIBIDOS_CCE.filter(c => lower.includes(c));
    setCceWarning(found.length > 0 ? `⚠️ A CC-e não pode corrigir: ${found.slice(0,3).join(', ')}. Use NF Complementar ou Devolução Simbólica.` : '');
  };

  const handleSubmit = async () => {
    if (!selectedInvoice) return;
    setError(''); setLoading(true);
    try {
      let result;
      if (tipoCorrecao === 'cce') {
        if (xCorrecao.length < 15) throw new Error('Mínimo 15 caracteres.');
        result = await api.post(`/api/invoices/${selectedInvoice.id}/cce`, { xCorrecao });
        setSuccess({ tipo:'cce', ...result });
      } else if (tipoCorrecao === 'complementar' || tipoCorrecao === 'reajuste') {
        if (diffVlr <= 0 && diffQtd <= 0) throw new Error('Informe a diferença de valor ou quantidade.');
        result = await api.post(`/api/invoices/${selectedInvoice.id}/complementar`, { tipo:tipoCorrecao, diffVlr, diffQtd, motivo, infCpl });
        setSuccess({ tipo:tipoCorrecao, ...result });
      } else if (tipoCorrecao === 'sinief13') {
        result = await api.post(`/api/invoices/${selectedInvoice.id}/anular-sinief13`, { motivo });
        setSuccess({ tipo:'sinief13', ...result });
      }
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div>
      <div className="alert alert-success">
        {success.tipo==='cce'?'✅ CC-e registrada!': success.tipo==='sinief13'?'✅ Anulação SINIEF 13/2024 iniciada!':'✅ NF Complementar gerada!'}
      </div>
      <div className="card">
        <div className="card-title">Resumo</div>
        {(success.tipo==='complementar'||success.tipo==='reajuste') && (
          <div className="result-grid">
            <div className="result-item"><div className="result-label">NF nº</div><div className="result-value">{success.numero}</div></div>
            <div className="result-item"><div className="result-label">Total</div><div className="result-value small">R$ {success.vTotal?.toFixed(2).replace('.',',')}</div></div>
            <div className="result-item"><div className="result-label">finNFe</div><div className="result-value small">2 - Complementar</div></div>
          </div>
        )}
        {success.tipo==='sinief13' && (
          <div className="alert alert-warning" style={{fontSize:13}}>
            ⚠️ Próximos passos:<br/>
            1. Destinatário registra "Operação não Realizada" na NF original<br/>
            2. Destinatário emite NF Devolução Simbólica (natOp: "Anulação de operação – Ajuste SINIEF 13/24")<br/>
            3. Você emite nova NF corrigida com as 2 chaves referenciadas
          </div>
        )}
        <div className="alert alert-warning mt-8" style={{fontSize:12}}>⚠️ Homologação — sem valor fiscal</div>
        <button className="btn btn-outline mt-8" onClick={()=>{setSuccess(null);setStep('select-nf');setSelectedInvoice(null);}}>+ Nova correção</button>
        <button className="btn btn-outline mt-8" onClick={onBack}>← Voltar</button>
      </div>
    </div>
  );

  if (step==='select-nf') return (
    <div>
      <div className="card"><div className="card-title">🔧 Correção de NF-e</div>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Selecione a NF-e a corrigir.</div>
        <input className="form-input" placeholder="Buscar por número, operação ou destinatário..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
      </div>
      {filtered.length===0 && <div className="card" style={{textAlign:'center',color:'var(--text-muted)',fontSize:14}}>Nenhuma NF-e emitida encontrada.</div>}
      {filtered.map(inv=>(
        <div key={inv.id} onClick={()=>handleSelectInvoice(inv)} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>NF-e nº {inv.numero} — Série {inv.serie}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>{inv.natOp}</div>
              {inv.customer&&<div style={{fontSize:12,color:'var(--text-muted)'}}>👤 {inv.customer.nome}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700,color:'var(--primary-light)',fontSize:15}}>R$ {inv.vTotal.toFixed(2).replace('.',',')}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{new Date(inv.dhEmi).toLocaleDateString('pt-BR')}</div>
              <div style={{fontSize:10,fontWeight:600,marginTop:4,background:'rgba(16,185,129,0.15)',color:'#10b981',borderRadius:4,padding:'2px 6px',display:'inline-block'}}>EMITIDA</div>
            </div>
          </div>
        </div>
      ))}
      <button className="btn btn-outline" onClick={onBack}>← Voltar</button>
    </div>
  );

  if (step==='select-tipo') return (
    <div>
      <div className="card" style={{padding:'12px 16px',marginBottom:12}}>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>NF-e selecionada:</div>
        <div style={{fontWeight:700}}>NF nº {selectedInvoice!.numero} — {selectedInvoice!.natOp}</div>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>R$ {selectedInvoice!.vTotal.toFixed(2).replace('.',',')} · {new Date(selectedInvoice!.dhEmi).toLocaleDateString('pt-BR')}</div>
      </div>
      <div className="card"><div className="card-title">Qual tipo de correção?</div>
        {TIPO_CORRECAO.map(t=>(
          <div key={t.id} onClick={()=>handleSelectTipo(t.id)} style={{background:t.cor,border:`1px solid ${t.borda}`,borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
              <span style={{fontSize:24,flexShrink:0}}>{t.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{t.titulo}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{t.subtitulo}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4,lineHeight:1.5}}>{t.descricao}</div>
                <div style={{display:'flex',gap:8,marginTop:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:10,background:'rgba(255,255,255,0.07)',borderRadius:4,padding:'2px 6px',color:'var(--text-muted)'}}>{t.badge}</span>
                  <span style={{fontSize:10,background:'rgba(255,255,255,0.07)',borderRadius:4,padding:'2px 6px',color:'var(--text-muted)'}}>⏱ {t.prazo}</span>
                </div>
              </div>
              <span style={{fontSize:18,color:'var(--text-muted)',flexShrink:0}}>›</span>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-outline" onClick={()=>setStep('select-nf')}>← Voltar</button>
    </div>
  );

  const tipoInfo = TIPO_CORRECAO.find(t=>t.id===tipoCorrecao)!;
  return (
    <div>
      <div className="card" style={{padding:'12px 16px',marginBottom:12}}>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>Corrigindo NF-e:</div>
        <div style={{fontWeight:700}}>NF nº {selectedInvoice!.numero} — {selectedInvoice!.natOp}</div>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>CFOP {selectedInvoice!.cfop} · R$ {selectedInvoice!.vTotal.toFixed(2).replace('.',',')}</div>
        {selectedInvoice!.chaveAcesso&&<div style={{fontSize:10,marginTop:2,wordBreak:'break-all',color:'var(--text-muted)'}}>Chave: {selectedInvoice!.chaveAcesso}</div>}
      </div>
      <div className="card" style={{background:tipoInfo.cor,border:`1px solid ${tipoInfo.borda}`,padding:'12px 16px',marginBottom:12}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:20}}>{tipoInfo.icon}</span>
          <div><div style={{fontWeight:700,fontSize:14}}>{tipoInfo.titulo}</div><div style={{fontSize:12,color:'var(--text-muted)'}}>{tipoInfo.badge} · {tipoInfo.prazo}</div></div>
        </div>
      </div>

      {(tipoCorrecao==='complementar'||tipoCorrecao==='reajuste') && (
        <div className="card">
          <div className="card-title">NF {tipoCorrecao==='reajuste'?'de Reajuste':'Complementar'}</div>
          {tipoCorrecao==='reajuste'&&<div className="alert alert-warning" style={{fontSize:12}}>⏱ Prazo: 3 dias após o reajuste. CFOP será o mesmo da original ({selectedInvoice!.cfop}).</div>}
          <div className="form-group">
            <label className="form-label">Diferença de Valor (R$)</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="0,00"
              value={diffVlr===0?'':diffVlr.toLocaleString('pt-BR',{minimumFractionDigits:2})}
              onChange={e=>{const r=e.target.value.replace(/\D/g,'');setDiffVlr(r?parseFloat(r)/100:0);}}/>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Valor a ser acrescentado (não o total da NF)</div>
          </div>
          <div className="form-group">
            <label className="form-label">Diferença de Quantidade (opcional)</label>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="0" value={diffQtd||''} onChange={e=>setDiffQtd(parseFloat(e.target.value)||0)}/>
          </div>
          {tipoCorrecao==='reajuste'&&<div className="form-group"><label className="form-label">Motivo do Reajuste</label><input className="form-input" placeholder="Ex: Reajuste contratual conforme cláusula 5ª..." value={motivo} onChange={e=>setMotivo(e.target.value)}/></div>}
          <div className="form-group">
            <label className="form-label">Informações Complementares</label>
            <textarea className="form-input" rows={4} value={infCpl} onChange={e=>setInfCpl(e.target.value)} style={{resize:'vertical'}}/>
          </div>
        </div>
      )}

      {tipoCorrecao==='cce' && (
        <div className="card">
          <div className="card-title">Carta de Correção Eletrônica</div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:'var(--text-muted)'}}>O QUE PODE SER CORRIGIDO POR CC-e:</div>
            {CAMPOS_CCE.map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginBottom:6,color:c.ok?'var(--success)':'var(--danger)'}}>
                <span>{c.ok?'✅':'❌'}</span><span>{c.campo}</span>
              </div>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Texto da Correção <span style={{fontSize:11,color:xCorrecao.length<15?'var(--danger)':'var(--success)',marginLeft:8}}>{xCorrecao.length}/1000 (mín. 15)</span></label>
            <textarea className="form-input" rows={5} placeholder="Onde se lê '...', leia-se '...'" value={xCorrecao} onChange={e=>checkCce(e.target.value)} style={{resize:'vertical'}}/>
            {cceWarning&&<div className="alert alert-danger mt-8" style={{fontSize:12}}>{cceWarning}</div>}
          </div>
          <div className="alert alert-warning" style={{fontSize:12}}>⚠️ A CC-e não pode corrigir dados que impliquem alteração de impostos, valores, quantidades, CFOP ou dados cadastrais principais.</div>
        </div>
      )}

      {tipoCorrecao==='sinief13' && (
        <div className="card">
          <div className="card-title">Devolução Simbólica — Ajuste SINIEF 13/2024</div>
          <div className="alert alert-warning" style={{fontSize:12,marginBottom:16}}>⏱ Válido apenas para erros identificados em até <strong>168 horas (7 dias)</strong> da entrega.</div>
          <div style={{background:'var(--bg)',borderRadius:8,padding:12,marginBottom:16,fontSize:13}}>
            <div style={{fontWeight:700,marginBottom:8}}>📋 Fluxo do Ajuste SINIEF 13/2024:</div>
            {[
              {n:'1',txt:'Registrar este pedido de anulação',ok:true},
              {n:'2',txt:'Destinatário emite NF Devolução Simbólica com natOp "Anulação de operação – Ajuste SINIEF 13/24"',ok:false},
              {n:'3',txt:'Você emite nova NF corrigida referenciando a original + a de devolução',ok:false},
              {n:'4',txt:'Destinatário registra "Confirmação da Operação" na nova NF',ok:false},
            ].map(s=>(
              <div key={s.n} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:8}}>
                <div style={{minWidth:22,height:22,borderRadius:'50%',background:s.ok?'var(--primary)':'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{s.n}</div>
                <div style={{fontSize:12,color:s.ok?'var(--text)':'var(--text-muted)',lineHeight:1.5}}>{s.txt}</div>
              </div>
            ))}
          </div>
          <div className="form-group"><label className="form-label">Motivo da anulação</label><textarea className="form-input" rows={3} placeholder="Ex: Erro no CFOP da NF original..." value={motivo} onChange={e=>setMotivo(e.target.value)}/></div>
          <div className="alert alert-danger" style={{fontSize:12}}>❌ Não se aplica a devoluções parciais ou operações de comércio exterior.</div>
        </div>
      )}

      {error&&<div className="alert alert-danger">{error}</div>}
      <div className="alert alert-warning" style={{fontSize:12}}>⚠️ Homologação — sem valor fiscal</div>
      <button className="btn btn-primary" onClick={handleSubmit} disabled={loading||(tipoCorrecao==='cce'&&xCorrecao.length<15)||(tipoCorrecao!=='cce'&&tipoCorrecao!=='sinief13'&&diffVlr<=0&&diffQtd<=0)}>
        {loading?'Processando...':(tipoCorrecao==='cce'?'✏️ Registrar CC-e':tipoCorrecao==='sinief13'?'🔄 Iniciar Anulação SINIEF 13/2024':'📄 Gerar NF Complementar')}
      </button>
      <button className="btn btn-outline mt-8" onClick={()=>setStep('select-tipo')}>← Voltar</button>
    </div>
  );
}