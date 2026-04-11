import { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Home from './pages/Home';
import History from './pages/History';
import Plans from './pages/Plans';
import Emit from './pages/Emit';
import { api } from './api';

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
  const [tab, setTab] = useState<'home' | 'emit' | 'history' | 'plans'>('home');
  const [fiscalContext, setFiscalContext] = useState<FiscalContext | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/api/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
  }, []);

  const handleLogin = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
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
        {tab === 'history' && <History />}
        {tab === 'plans' && <Plans user={user} onSuccess={() => setTab('home')} />}
      </main>

      <nav className="bottom-nav">
        <button className={`nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <span className="nav-icon">🔍</span>
          Consultar
        </button>
        <button className={`nav-item ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <span className="nav-icon">📂</span>
          Histórico
        </button>
        <button className={`nav-item ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>
          <span className="nav-icon">💳</span>
          Planos
        </button>
      </nav>
    </div>
  );
}
