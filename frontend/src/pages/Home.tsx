import { useState, useEffect, useCallback } from 'react';
import type { User } from '../App';
import { api } from '../api';

type FiscalContext = { originUf:string; destinationUf:string; operation:string; purpose:string; taxRegime:string; tpNF:'0'|'1'; serie:string; };
type Props = { user:User; onNeedPlan:()=>void; onEmitWithContext:(ctx:FiscalContext)=>void; onCorrect:()=>void; };

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO','EX'];

const OPS: Record<string,Array<{v:string;l:string}>> = {
  '1': [{v:'venda',l:'Venda'},{v:'remessa',l:'Remessa'},{v:'devolucao',l:'Devolucao ao Fornecedor'},{v:'servico',l:'Prestacao de Servico'}],
  '0': [{v:'compra',l:'Compra'},{v:'retorno',l:'Retorno de Remessa'},{v:'devolucao',l:'Devolucao de Venda'},{v:'importacao',l:'Importacao'}],
};

const PURP: Record<string,Record<string,Array<{v:string;l:string}>>> = {
  '1': {
    venda:[{v:'normal',l:'Venda direta'},{v:'substituicao_tributaria',l:'Com Substituicao Tributaria'},{v:'exportacao',l:'Exportacao'}],
    remessa:[{v:'normal',l:'Remessa normal'},{v:'exportacao',l:'Com fim especifico de exportacao'}],
    devolucao:[{v:'venda',l:'Devolucao de compra ao fornecedor'}],
    servico:[{v:'normal',l:'Prestacao de servico (ISSQN)'}],
  },
  '0': {
    compra:[{v:'normal',l:'Compra para comercializacao'},{v:'substituicao_tributaria',l:'Compra com Substituicao Tributaria'}],
    retorno:[{v:'normal',l:'Retorno de remessa propria'}],
    devolucao:[{v:'venda',l:'Devolucao recebida do cliente'}],
    importacao:[{v:'importacao',l:'Importacao do exterior'}],
  },
};

export default function Home({ user, onNeedPlan, onEmitWithContext, onCorrect }: Props) {
  const [oUf, setOUf] = useState('SP');
  const [dUf, setDUf] = useState('SP');
  const [tpNF, setTpNF] = useState<'0'|'1'>('1');
  const [op, setOp] = useState('');
  const [purp, setPurp] = useState('');
  const [fiscal, setFiscal] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isInter = oUf !== dUf;
  const ops = OPS[tpNF] || [];
  const purps = ((PURP[tpNF] || {})[op]) || [];
  const serie = tpNF === '1' ? 'Serie 1' : 'Serie 2';

  const handleTpNF = (t:'0'|'1') => { setTpNF(t); setOp(''); setPurp(''); setFiscal(null); };

  const query = useCallback(async () => {
    if (!op || !purp) return;
    setLoading(true);
    try { const d = await api.post('/api/fiscal-engine/query',{originUf:oUf,destinationUf:dUf,operation:op,purpose:purp,taxRegime:'simples_nacional',tpNF}); setFiscal(d); }
    catch { setFiscal(null); }
    finally { setLoading(false); }
  }, [oUf, dUf, op, purp, tpNF]);

  useEffect(()=>{ query(); },[query]);

  const handleEmit = () => {
    if (!fiscal?.cfop) return;
    if (!user.subscription || user.subscription.plan === 'FREE') { onNeedPlan(); return; }
    onEmitWithContext({originUf:oUf,destinationUf:dUf,operation:op,purpose:purp,taxRegime:'simples_nacional',tpNF,serie});
  };

  return (
    <div>
      <div style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12}}>
        <div style={{fontWeight:700,color:'#f59e0b',marginBottom:4}}>Atualizacao NT 2024.001 v1_20</div>
        <div style={{color:'var(--text-muted)',lineHeight:1.5}}>A partir de 01/04/2025, restricao nos CFOPs para MEI. Motor fiscal configurado conforme regras atualizadas. <a href="https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=" style={{color:'var(--primary-light)'}} target="_blank" rel="noreferrer">Ver NT completa</a></div>
      </div>

      <div className="card">
        <div className="card-title">Consultar Motor Fiscal</div>

        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{flex:1}}><label className="form-label">UF Origem</label><select className="form-input" value={oUf} onChange={e=>setOUf(e.target.value)}>{UFS.map(u=><option key={u} value={u}>{u}{u==='EX'?' (Exterior)':''}</option>)}</select></div>
          <div style={{flex:1}}><label className="form-label">UF Destino</label><select className="form-input" value={dUf} onChange={e=>setDUf(e.target.value)}>{UFS.map(u=><option key={u} value={u}>{u}{u==='EX'?' (Exterior)':''}</option>)}</select></div>
        </div>

        <div style={{marginBottom:12}}>
          <span style={{fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20,background:isInter?'rgba(239,68,68,0.15)':'rgba(16,185,129,0.15)',color:isInter?'#ef4444':'#10b981'}}>{isInter?'Interestadual':'Intraestadual'}</span>
        </div>

        <label className="form-label">Tipo de Nota Fiscal</label>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          {[{t:'1',l:'Saida',d:'Venda, remessa, servico',s:'Serie 1'},{t:'0',l:'Entrada',d:'Compra, retorno, devolucao',s:'Serie 2'}].map(x=>(
            <button key={x.t} onClick={()=>handleTpNF(x.t as '0'|'1')} style={{flex:1,padding:'12px 10px',borderRadius:10,cursor:'pointer',border:'2px solid '+(tpNF===x.t?'var(--primary)':'var(--border)'),background:tpNF===x.t?'rgba(99,102,241,0.12)':'var(--bg)',textAlign:'center',transition:'all 0.15s'}}>
              <div style={{fontWeight:800,fontSize:15,color:tpNF===x.t?'var(--primary-light)':'var(--text)'}}>{x.l}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{x.d}</div>
              <div style={{fontSize:10,fontWeight:700,marginTop:4,borderRadius:4,padding:'2px 6px',display:'inline-block',color:tpNF===x.t?'var(--primary-light)':'var(--text-muted)',background:tpNF===x.t?'rgba(99,102,241,0.15)':'rgba(255,255,255,0.05)'}}>{x.s}</div>
            </button>
          ))}
        </div>

        <div style={{display:'flex',gap:8,marginTop:8,marginBottom:12}}>
          <button onClick={onCorrect} style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',border:'1.5px dashed rgba(245,158,11,0.5)',background:'rgba(245,158,11,0.07)',textAlign:'center'}}>
            <div style={{fontWeight:700,fontSize:13,color:'#f59e0b'}}>NF Complementar</div>
            <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Diferenca de preco ou quantidade</div>
          </button>
          <button onClick={onCorrect} style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',border:'1.5px dashed rgba(99,102,241,0.5)',background:'rgba(99,102,241,0.07)',textAlign:'center'}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--primary-light)'}}>Carta de Correcao</div>
            <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Corrigir dados sem afetar valores</div>
          </button>
        </div>

        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12,padding:'6px 10px',background:'var(--bg)',borderRadius:8}}>
          Serie: <strong>{serie}</strong> -- NF-e de {tpNF==='1'?'Saida':'Entrada'} (tpNF={tpNF})
        </div>

        <div className="form-group">
          <label className="form-label">Tipo de Operacao</label>
          <select className="form-input" value={op} onChange={e=>{setOp(e.target.value);setPurp('');setFiscal(null);}}>
            <option value="">Selecione a operacao...</option>
            {ops.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        {op && purps.length > 0 && (
          <div className="form-group">
            <label className="form-label">Finalidade</label>
            <select className="form-input" value={purp} onChange={e=>setPurp(e.target.value)}>
              <option value="">Selecione...</option>
              {purps.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </div>
        )}

        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>Regime: <strong>Simples Nacional / MEI</strong></div>

        {loading && <div style={{textAlign:'center',padding:12,color:'var(--text-muted)'}}>Consultando...</div>}

        {fiscal && !loading && (
          <div className="result-grid" style={{marginBottom:12}}>
            <div className="result-item"><div className="result-label">CFOP</div><div className="result-value">{fiscal.cfop}</div></div>
            <div className="result-item"><div className="result-label">CST/CSOSN</div><div className="result-value small">{fiscal.cstCsosn}</div></div>
            <div className="result-item"><div className="result-label">Natureza</div><div className="result-value small">{fiscal.natOp}</div></div>
            <div className="result-item"><div className="result-label">ICMS</div><div className="result-value small">{fiscal.icmsRegime}</div></div>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleEmit} disabled={!fiscal?.cfop||loading}>
          {loading?'Consultando...':'Emitir NF-e'}
        </button>
      </div>
    </div>
  );
}