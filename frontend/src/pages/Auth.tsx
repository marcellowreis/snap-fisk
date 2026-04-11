import { useState } from 'react';
import { api } from '../api';
import type { User } from '../App';

type Props = {
  onLogin: (token: string, user: User) => void;
};

export default function Auth({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCnpj = (v: string) =>
    v.replace(/\D/g, '').slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { cnpj, password }
        : { cnpj, email, password };
      const data = await api.post(path, body);
      onLogin(data.token, data.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">Snap Fisk</div>
      <div className="auth-tagline">Emita NF-e sem errar imposto</div>

      <div className="auth-card">
        <div className="auth-title">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="form-group">
          <label className="form-label">CNPJ</label>
          <input
            className="form-input"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={e => setCnpj(formatCnpj(e.target.value))}
          />
        </div>

        {mode === 'register' && (
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Senha</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••"
              value={password}
              style={{ paddingRight: 44 }}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--text-muted)',
                padding: 0,
                lineHeight: 1,
              }}
              title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading || !cnpj || !password}
        >
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Não tem conta?{' '}
              <button onClick={() => { setMode('register'); setError(''); }}>
                Criar agora
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button onClick={() => { setMode('login'); setError(''); }}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
