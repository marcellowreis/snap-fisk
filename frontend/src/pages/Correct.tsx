import { useState, useEffect } from 'react';
import { api } from '../api';
import type { User } from '../App';

type Invoice = { id:string; numero:number; serie:string; natOp:string; cfop:string; chaveAcesso?:string; dhEmi:string; vTotal:number; tpNF:string; status:string; customer?:{nome:string;cpfCnpj:string}; items?:any[]; };
type Props = { user: User; onBack: () => void };

const TIPOS = [
  { id:'complementar', titulo:'NF Complementar', sub:'Diferenca de preco ou quantidade a menor', desc:'Emita quando o valor ou quantidade foi menor que o correto.', cor:'rgba(99,102,241,0.15)', borda:'rgba(99,102,241,0.4)', badge:'RICMS-SP art. 182', prazo:'Sem prazo especial.' },
  { id:'reajuste', titulo:'Reajuste de Preco', sub:'Aumento de preco por contrato', desc:'Prazo: 3 dias apos o reajuste. Mesmo CFOP da original.', cor:'rgba(16,185,129,0.12)', borda:'rgba(16,185,129,0.35)', badge:'RICMS-SP art. 182 S1', prazo:'3 dias apos o reajuste.' },
  { id:'cce', titulo:'Carta de Correcao', sub:'Erros que nao afetam valores', desc:'Corrige dados que nao impactam CFOP, aliquota, valor ou dados cadastrais principais.', cor:'rgba(245,158,11,0.12)', borda:'rgba(245,158,11,0.35)', badge:'SINIEF 7/2005', prazo:'Ate 30 dias.' },
  { id:'sinief13', titulo:'Devolucao Simbolica', sub:'Erro grave - SINIEF 13/2024', desc:'Quando nao e possivel usar NF Complementar ou CC-e. Ate 168h da entrega.', cor:'rgba(239,68,68,0.1)', borda:'rgba(239,68,68,0.35)', badge:'SINIEF 13/2024', prazo:'Ate 168h da entrega.' },
];

const CCE_CAMPOS = [
  {c:'Valor / base de calculo',ok:false},{c:'Aliquota ICMS / IPI',ok:false},{c:'Quantidade',ok:false},
  {c:'CFOP',ok:false},{c:'CST / CSOSN',ok:false},{c:'CNPJ / CPF emitente ou destinatario',ok:false},
  {c:'Data de emissao ou saida',ok:false},{c:'Numero e serie',ok:false},
  {c:'Razao social (sem alterar identidade)',ok:true},{c:'Endereco (sem alterar UF)',ok:true},
  {c:'Dados de frete',ok:true},{c:'Observacoes complementares',ok:true},
];

const PROIBIDOS = ['valor','preco','aliquota','icms','ipi','quantidade','cfop','cst','csosn','cnpj','cpf','destinatario','remetente','emitente'];

function BV({ onClick }: { onClick:()=>void }) {
  return <button className="btn btn-outline" onClick={onClick} style={{marginBottom:12}}>voltar</button>;
}

export default function Correct({ user, onBack }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [inv, setInv] = useState<Invoice|null>(null);
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [step, setStep] = useState<'nf'|'tipo'|'form'>('nf');
  const [chave, setChave] = useState('');
  const [dv, setDv] = useState(0);
  const [dq, setDq] = useState(0);
  const [mot, setMot] = useState('');
  const [inf, setInf] = useState('');
  const [xc, setXc] = useState('');
  const [warn, setWarn] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState<any>(null);

  useEffect(()=>{ api.get('/api/invoices?status=EMITIDA&limit=50').then(d=>setInvoices(Array.isArray(d)?d:d.invoices||[])).catch(()=>{}); },[]);

  const list = invoices.filter(i=>{ const s=q.toLowerCase(); return !s||i.numero.toString().includes(s)||i.natOp.toLowerCase().includes(s)||(i.customer?.nome||'').toLowerCase().includes(s); });

  const selInv = (i:Invoice)=>{ setInv(i); setTipo(''); setErr(''); setStep('tipo'); };

  const selTipo = (t:string) => {
    setTipo(t);
    setChave(inv?.chaveAcesso||'');
    if(t==='complementar'||t==='reajuste'){
      const ds = new Date(inv!.dhEmi).toLocaleDateString('pt-BR');
      setInf('NF '+(t==='reajuste'?'de reajuste':'complementar')+' ref. NF n '+inv!.numero+', serie '+inv!.serie+', de '+ds+', R$ '+inv!.vTotal.toFixed(2).replace('.',',')+'.'); 
    }
    setXc(''); setWarn(''); setMot(''); setDv(0); setDq(0); setStep('form');
  };

  const chkCce=(txt:string)=>{ setXc(txt); const l=txt.toLowerCase(); const f=PROIBIDOS.filter(p=>l.includes(p)); setWarn(f.length>0?'Atencao: CC-e nao pode corrigir: '+f.slice(0,3).join(', '):''); };

  const submit=async()=>{
    if(!inv){return;} setErr(''); setLoading(true);
    try {
      if(tipo==='cce'){
        if(xc.length<15){throw new Error('Minimo 15 caracteres.');}
        setOk({tipo:'cce',...await api.post('/api/invoices/'+inv.id+'/cce',{xCorrecao:xc})});
      } else if(tipo==='complementar'||tipo==='reajuste'){
        if(dv<=0&&dq<=0){throw new Error('Informe diferenca de valor ou quantidade.');}
        setOk({tipo,...await api.post('/api/invoices/'+inv.id+'/complementar',{tipo,diffVlr:dv,diffQtd:dq,motivo:mot,infCpl:inf,chaveRef:chave})});
      } else if(tipo==='sinief13'){
        setOk({tipo:'sinief13',...await api.post('/api/invoices/'+inv.id+'/anular-sinief13',{motivo:mot})});
      }
    } catch(e:any){setErr(e.message);} finally{setLoading(false);}
  };

  const reset=()=>{ setOk(null); setStep('nf'); setInv(null); setTipo(''); setErr(''); };

  if(ok) return(
    <div>
      <BV onClick={reset}/>
      <div className="alert alert-success">{ok.tipo==='cce'?'CC-e registrada!':ok.tipo==='sinief13'?'Anulacao SINIEF 13/2024 iniciada!':'NF Complementar gerada!'}</div>
      <div className="card">
        <div className="card-title">Resumo</div>
        {(ok.tipo==='complementar'||ok.tipo==='reajuste')&&<div className="result-grid"><div className="result-item"><div className="result-label">NF n</div><div className="result-value">{ok.numero}</div></div><div className="result-item"><div className="result-label">Total</div><div className="result-value small">R$ {ok.vTotal?.toFixed(2).replace('.',',')}</div></div></div>}
        {ok.tipo==='sinief13'&&<div className="alert alert-warning" style={{fontSize:13}}>Proximos passos:<br/>1. Destinatario registra operacao nao realizada<br/>2. Emite NF Devolucao Simbolica<br/>3. Voce emite nova NF com 2 chaves</div>}
        <div className="alert alert-warning mt-8" style={{fontSize:12}}>Homologacao - sem valor fiscal</div>
        <button className="btn btn-outline mt-8" onClick={reset}>+ Nova correcao</button>
      </div>
    </div>
  );

  if(step==='nf') return(
    <div>
      <BV onClick={onBack}/>
      <div className="card"><div className="card-title">Correcao de NF-e</div><div style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Selecione a NF-e a corrigir.</div><input className="form-input" placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      {list.length===0&&<div className="card" style={{textAlign:'center',color:'var(--text-muted)',fontSize:14}}>Nenhuma NF-e emitida encontrada.</div>}
      {list.map(i=>(
        <div key={i.id} onClick={()=>selInv(i)} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div><div style={{fontWeight:700,fontSize:15}}>NF-e n {i.numero} - Serie {i.serie}</div><div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>{i.natOp}</div>{i.customer&&<div style={{fontSize:12,color:'var(--text-muted)'}}>{i.customer.nome}</div>}</div>
            <div style={{textAlign:'right'}}><div style={{fontWeight:700,color:'var(--primary-light)',fontSize:15}}>R$ {i.vTotal.toFixed(2).replace('.',',')}</div><div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{new Date(i.dhEmi).toLocaleDateString('pt-BR')}</div><div style={{fontSize:10,fontWeight:600,marginTop:4,background:'rgba(16,185,129,0.15)',color:'#10b981',borderRadius:4,padding:'2px 6px',display:'inline-block'}}>EMITIDA</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  if(step==='tipo') return(
    <div>
      <BV onClick={()=>setStep('nf')}/>
      <div className="card" style={{padding:'12px 16px',marginBottom:12}}><div style={{fontSize:12,color:'var(--text-muted)'}}>NF-e selecionada:</div><div style={{fontWeight:700}}>NF n {inv!.numero} - {inv!.natOp}</div><div style={{fontSize:12,color:'var(--text-muted)'}}>R$ {inv!.vTotal.toFixed(2).replace('.',',')} - {new Date(inv!.dhEmi).toLocaleDateString('pt-BR')}</div></div>
      <div className="card"><div className="card-title">Qual tipo de correcao?</div>
        {TIPOS.map(t=>(
          <div key={t.id} onClick={()=>selTipo(t.id)} style={{background:t.cor,border:'1px solid '+t.borda,borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer'}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{t.titulo}</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>{t.sub}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5,marginBottom:6}}>{t.desc}</div>
            <span style={{fontSize:10,background:'rgba(255,255,255,0.07)',borderRadius:4,padding:'2px 6px',color:'var(--text-muted)',marginRight:6}}>{t.badge}</span>
            <span style={{fontSize:10,background:'rgba(255,255,255,0.07)',borderRadius:4,padding:'2px 6px',color:'var(--text-muted)'}}>{t.prazo}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const ti = TIPOS.find(t=>t.id===tipo)!;
  return(
    <div>
      <BV onClick={()=>setStep('tipo')}/>
      <div className="card" style={{padding:'12px 16px',marginBottom:12}}>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>Corrigindo NF-e:</div>
        <div style={{fontWeight:700}}>NF n {inv!.numero} - {inv!.natOp}</div>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>CFOP {inv!.cfop} - R$ {inv!.vTotal.toFixed(2).replace('.',',')}</div>
        {inv!.chaveAcesso&&<div style={{fontSize:10,marginTop:4,wordBreak:'break-all',color:'var(--text-muted)'}}>Chave: {inv!.chaveAcesso}</div>}
      </div>
      <div className="card" style={{background:ti.cor,border:'1px solid '+ti.borda,padding:'12px 16px',marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14}}>{ti.titulo}</div>
        <div style={{fontSize:12,color:'var(--text-muted)'}}>{ti.badge} - {ti.prazo}</div>
      </div>

      {(tipo==='complementar'||tipo==='reajuste')&&(
        <div className="card">
          <div className="card-title">{tipo==='reajuste'?'NF de Reajuste':'NF Complementar'}</div>
          {tipo==='reajuste'&&<div className="alert alert-warning" style={{fontSize:12}}>Prazo: 3 dias apos o reajuste. CFOP sera o mesmo ({inv!.cfop}).</div>}
          <div className="form-group">
            <label className="form-label">Chave de Acesso da NF a {tipo==='reajuste'?'reajustar':'complementar'}</label>
            <input className="form-input" placeholder="44 digitos..." value={chave} onChange={e=>setChave(e.target.value.replace(/[^0-9]/g,'').slice(0,44))} maxLength={44} style={{fontFamily:'monospace',fontSize:12}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:chave.length===44?'var(--success)':'var(--text-muted)',marginTop:4}}>
              <span>{chave.length===44?'Chave valida':chave.length+'/44 digitos'}</span>
              {inv!.chaveAcesso&&chave!==inv!.chaveAcesso&&<button style={{background:'none',border:'none',color:'var(--primary-light)',fontSize:11,cursor:'pointer'}} onClick={()=>setChave(inv!.chaveAcesso!)}>Usar chave da NF selecionada</button>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Diferenca de Valor (R$)</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="0,00" value={dv===0?'':dv.toLocaleString('pt-BR',{minimumFractionDigits:2})} onChange={e=>{const r=e.target.value.replace(/[^0-9]/g,'');setDv(r?parseFloat(r)/100:0);}}/>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Valor a acrescentar (nao o total)</div>
          </div>
          <div className="form-group"><label className="form-label">Diferenca de Quantidade (opcional)</label><input className="form-input" type="number" min="0" step="0.01" placeholder="0" value={dq||''} onChange={e=>setDq(parseFloat(e.target.value)||0)}/></div>
          {tipo==='reajuste'&&<div className="form-group"><label className="form-label">Motivo do Reajuste</label><input className="form-input" placeholder="Ex: Reajuste contratual..." value={mot} onChange={e=>setMot(e.target.value)}/></div>}
          <div className="form-group"><label className="form-label">Informacoes Complementares</label><textarea className="form-input" rows={4} value={inf} onChange={e=>setInf(e.target.value)} style={{resize:'vertical'}}/></div>
        </div>
      )}

      {tipo==='cce'&&(
        <div className="card">
          <div className="card-title">Carta de Correcao Eletronica</div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:'var(--text-muted)'}}>PODE SER CORRIGIDO:</div>
            {CCE_CAMPOS.map((c,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginBottom:6,color:c.ok?'var(--success)':'var(--danger)'}}><span>{c.ok?'OK':'X'}</span><span>{c.c}</span></div>)}
          </div>
          <div className="form-group">
            <label className="form-label">Texto da Correcao <span style={{fontSize:11,marginLeft:8,color:xc.length<15?'var(--danger)':'var(--success)'}}>{xc.length}/1000 (min 15)</span></label>
            <textarea className="form-input" rows={5} placeholder="Onde se le ..., leia-se ..." value={xc} onChange={e=>chkCce(e.target.value)} style={{resize:'vertical'}}/>
            {warn&&<div className="alert alert-danger mt-8" style={{fontSize:12}}>{warn}</div>}
          </div>
          <div className="alert alert-warning" style={{fontSize:12}}>CC-e nao pode corrigir impostos, valores, quantidades, CFOP ou dados cadastrais.</div>
        </div>
      )}

      {tipo==='sinief13'&&(
        <div className="card">
          <div className="card-title">Devolucao Simbolica - SINIEF 13/2024</div>
          <div className="alert alert-warning" style={{fontSize:12,marginBottom:16}}>Valido ate 168h (7 dias) da entrega.</div>
          <div style={{background:'var(--bg)',borderRadius:8,padding:12,marginBottom:16}}>
            {[{n:'1',t:'Registrar pedido de anulacao',ok:true},{n:'2',t:'Destinatario emite NF Devolucao Simbolica',ok:false},{n:'3',t:'Voce emite nova NF com 2 chaves referenciadas',ok:false},{n:'4',t:'Destinatario confirma nova NF',ok:false}].map(s=>(
              <div key={s.n} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:8}}>
                <div style={{minWidth:22,height:22,borderRadius:'50%',background:s.ok?'var(--primary)':'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{s.n}</div>
                <div style={{fontSize:12,color:s.ok?'var(--text)':'var(--text-muted)',lineHeight:1.5}}>{s.t}</div>
              </div>
            ))}
          </div>
          <div className="form-group"><label className="form-label">Motivo da anulacao</label><textarea className="form-input" rows={3} placeholder="Ex: Erro no CFOP..." value={mot} onChange={e=>setMot(e.target.value)}/></div>
          <div className="alert alert-danger" style={{fontSize:12}}>Nao se aplica a devolucoes parciais ou comercio exterior.</div>
        </div>
      )}

      {err&&<div className="alert alert-danger">{err}</div>}
      <div className="alert alert-warning" style={{fontSize:12}}>Homologacao - sem valor fiscal</div>
      <button className="btn btn-primary" onClick={submit} disabled={loading||(tipo==='cce'&&xc.length<15)||(tipo!=='cce'&&tipo!=='sinief13'&&dv<=0&&dq<=0)}>
        {loading?'Processando...':tipo==='cce'?'Registrar CC-e':tipo==='sinief13'?'Iniciar Anulacao SINIEF 13/2024':'Gerar NF Complementar'}
      </button>
    </div>
  );
}