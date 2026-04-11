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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'home' | 'emit' | 'history' | 'plans'>('home');

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
        {tab === 'home' && <Home user={user} onNeedPlan={() => setTab('plans')} onEmit={() => setTab('emit')} />}
        {tab === 'emit' && <Emit user={user} onBack={() => setTab('home')} />}
        {tab === 'history' && <History />}
        {tab === 'plans' && <Plans user={user} onSuccess={() => setTab('home')} />}
      </main>

      <nav className="bottom-nav">
        <button className={`nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <span className="nav-icon">🔍</span>
          Consultar
        </button>
        <button className={`nav-item ${tab === 'emit' ? 'active' : ''}`} onClick={() => setTab('emit')}>
          <span className="nav-icon">📄</span>
          Emitir NF
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
