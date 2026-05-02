import { useState, useEffect } from 'react';
import { api } from './api';
import Login from './pages/Login';
import Home from './pages/Home';
import Emit from './pages/Emit';
import History from './pages/History';
import Plans from './pages/Plans';
import Company from './pages/Company';
import Cfop from './pages/Cfop';
import Correct from './pages/Correct';
import GuiaMei from './pages/GuiaMei';

export type User = {
  id: string; cnpj: string; email?: string;
  company?: { razaoSocial:string; nomeFantasia?:string; cnpj:string; inscricaoEstadual?:string; municipio?:string; uf?:string; cep?:string; logradouro?:string; numero?:string; complemento?:string; bairro?:string; telefone?:string; email?:string; regimeTributario?:string; };
  subscription?: { plan:string; nfCount?:number; nfLimit?:number; };
};

type FiscalContext = { originUf:string; destinationUf:string; operation:string; purpose:string; taxRegime:string; tpNF:'0'|'1'; serie:string; };
type Tab = 'home'|'emit'|'history'|'plans'|'company'|'cfop'|'correct';

export default function App() {
  const [user, setUser] = useState<User|null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [emitCtx, setEmitCtx] = useState<FiscalContext|null>(null);
  const [showGuia, setShowGuia] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me').then(u => { setUser(u); setLoading(false); }).catch(() => { sessionStorage.removeItem('token'); setLoading(false); });
  }, []);

  const handleLogin = (u: User) => setUser(u);
  const handleLogout = () => { sessionStorage.removeItem('token'); setUser(null); setTab('home'); };

  const handleEmitWithContext = (ctx: FiscalContext) => { setEmitCtx(ctx); setTab('emit'); };

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text-muted)'}}>Carregando...</div>;
  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-container">
      <div className="app-header">
        <div>
          <div style={{fontWeight:700,fontSize:15}}>Snap Fisk</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{user.company?.cnpj || user.cnpj} {user.company?.nomeFantasia || user.company?.razaoSocial || ''}</div>
        </div>
        <button className="btn btn-outline" style={{fontSize:12,padding:'6px 12px'}} onClick={handleLogout}>Sair</button>
      </div>

      <div className="app-content">
        {tab === 'home' && <Home user={user} onNeedPlan={() => setTab('plans')} onEmitWithContext={handleEmitWithContext} onCorrect={() => setTab('correct')} />}
        {tab === 'emit' && <Emit user={user} initialContext={emitCtx} onBack={() => setTab('home')} onSuccess={() => setTab('history')} />}
        {tab === 'history' && <History user={user} />}
        {tab === 'plans' && <Plans user={user} onBack={() => setTab('home')} />}
        {tab === 'company' && <Company user={user} onBack={() => setTab('home')} onUpdate={(u) => setUser(u)} />}
        {tab === 'cfop' && <Cfop />}
        {tab === 'correct' && <Correct user={user} onBack={() => setTab('home')} />}
        {showGuia && <GuiaMei isOpen={showGuia} onClose={() => setShowGuia(false)} />}
      </div>

      <nav className="app-nav">
        <button className={'nav-item ' + (tab==='home'?'active':'')} onClick={() => setTab('home')}>Consultar</button>
        <button className={'nav-item ' + (tab==='cfop'?'active':'')} onClick={() => setTab('cfop')}>CFOP</button>
        <button className={'nav-item ' + (tab==='history'?'active':'')} onClick={() => setTab('history')}>Historico</button>
        <button className={'nav-item ' + (tab==='plans'?'active':'')} onClick={() => setTab('plans')}>Planos</button>
        <button className={'nav-item ' + (tab==='company'?'active':'')} onClick={() => setTab('company')}>Empresa</button>
        <button className={'nav-item ' + (tab==='correct'?'active':'')} onClick={() => setTab('correct')}>Corrigir</button>
      </nav>
    </div>
  );
}