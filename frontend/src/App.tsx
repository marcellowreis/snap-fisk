import { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Home from './pages/Home';
import History from './pages/History';
import Plans from './pages/Plans';
import Emit from './pages/Emit';
import { api } from './api';
import Company from './pages/Company';
import Cfop from './pages/Cfop';

export type User = {
  id: string;
  cnpj: string;
  email: string;
  company?: any;
  subscription?: any;
};

export type FiscalContext = {
  operation: string;
  purpose: string;
  originUf: string;
  destinationUf: string;
  cfop: string;
  cstCsosn: string;
  naturezaOperacao: string;
  informacoesComplementares: string;
  mensagemAlerta: string;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'home' | 'emit' | 'history' | 'plans' | 'company' | 'cfop'>('home');
  const [firstAccess, setFirstAccess] = useState(false);
  const [fiscalContext, setFiscalContext] = useState<FiscalContext | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/api/me').then(u => {
      setUser(u);
      if (!u.company) {
        setFirstAccess(true);
        setTab('company');
      }
    }).catch(() => sessionStorage.removeItem('token')).finally(() => setLoading(false));
  }, []);

  const handleLogin = (token: string, userData: User) => {
    sessionStorage.setItem('token', token);
    setUser(userData);
    if (!userData.company) {
      setFirstAccess(true);
      setTab('company');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setUser(null);
    setTab('home');
    setFiscalContext(null);
  };

  const handleEmitWithContext = (ctx: FiscalContext) => {
    setFiscalContext(ctx);
    setTab('emit');
  };

  if (loading) return (
    <div className="auth-page">
      <div className="auth-logo">Snap Fisk</div>
      <div className="spinner" />
    </div>
  );

  if (!user) return <Auth onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="header-logo">Snap Fisk</div>
          <div className="header-sub">{user.company?.razaoSocial || user.cnpj}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Sair</button>
      </header>

      <main className="page">
        {tab === 'home' && (
          <Home
            user={user}
            onNeedPlan={() => setTab('plans')}
            onEmitWithContext={handleEmitWithContext}
          />
        )}
        {tab === 'emit' && (
          <Emit
            user={user}
            fiscalContext={fiscalContext}
            onBack={() => { setTab('home'); setFiscalContext(null); }}
          />
        )}
        {tab === 'history' && <History user={user} />}
        {tab === 'plans' && <Plans user={user} onSuccess={() => setTab('home')} />}
        {tab === 'cfop' && <Cfop />}
        {tab === 'company' && (
          <Company
            user={user}
            isFirstAccess={firstAccess}
            onSaved={company => {
              setUser(prev => prev ? { ...prev, company } : prev);
              setFirstAccess(false);
              setTab('home');
            }}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button className={`nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <span className="nav-icon">🔍</span>
          Consultar
        </button>
        <button className={`nav-item ${tab === 'cfop' ? 'active' : ''}`} onClick={() => setTab('cfop')}>
          <span className="nav-icon">📋</span>
          CFOP
        </button>
        <button className={`nav-item ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <span className="nav-icon">📂</span>
          Histórico
        </button>
        <button className={`nav-item ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>
          <span className="nav-icon">💳</span>
          Planos
        </button>
        <button className={`nav-item ${tab === 'company' ? 'active' : ''}`} onClick={() => setTab('company')}>
          <span className="nav-icon">🏢</span>
          Empresa
        </button>
      </nav>
    </div>
  );
}
