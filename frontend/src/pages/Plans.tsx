import { useState, useEffect } from 'react';
import { api } from '../api';
import type { User } from '../App';

type Props = {
  user: User;
  onSuccess: () => void;
};

export default function Plans({ user, onSuccess }: Props) {
  const [plans, setPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [pix, setPix] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/plans'),
      api.get('/api/subscription'),
    ]).then(([p, s]) => {
      setPlans(p);
      setSubscription(s);
      if (s?.plan?.code) setSelected(s.plan.code);
      else if (p.length > 0) setSelected(p[1]?.code ?? p[0].code);
    }).finally(() => setLoading(false));
  }, []);

  const handlePay = async () => {
    setError('');
    setPaying(true);
    try {
      const data = await api.post('/api/billing/pix', { planCode: selected });
      setPix(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  };

  const handleConfirm = async () => {
    if (!pix) return;
    setPaying(true);
    try {
      await api.post(`/api/billing/${pix.chargeId}/confirm`, {});
      alert('✅ Pagamento confirmado! Plano ativado.');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  };

  const copyPix = () => {
    navigator.clipboard.writeText(pix.pixCode);
    alert('Código PIX copiado!');
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const planLabel = (code: string) =>
    code === 'SNAP_ONE' ? '1 NF' : code === 'SNAP_TEN' ? 'Até 10 NF/mês' : 'Ilimitado/mês';

  return (
    <div>
      {subscription?.status === 'ACTIVE' && (
        <div className="alert alert-success mb-16">
          ✅ Plano ativo: <strong>{subscription.plan.name}</strong> — {planLabel(subscription.plan.code)}
          {subscription.endDate && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Válido até {new Date(subscription.endDate).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
      )}

      <div className="card-title">Escolha seu plano</div>

      {plans.map(plan => (
        <div
          key={plan.code}
          className={`plan-card ${selected === plan.code ? 'selected' : ''} ${plan.code === 'SNAP_TEN' ? 'popular' : ''}`}
          onClick={() => { setSelected(plan.code); setPix(null); }}
        >
          {plan.code === 'SNAP_TEN' && <div className="popular-badge">⭐ Mais popular</div>}
          <div className="plan-name">{plan.name}</div>
          <div className="plan-price">
            R$ {plan.price.toFixed(2).replace('.', ',')}
            {plan.code !== 'SNAP_ONE' && <span style={{ fontSize: 16, fontWeight: 400 }}>/mês</span>}
          </div>
          <div className="plan-desc">{plan.description}</div>
          <div className="badge badge-success">{planLabel(plan.code)}</div>
        </div>
      ))}

      {error && <div className="alert alert-danger">{error}</div>}

      {!pix ? (
        <button className="btn btn-primary" onClick={handlePay} disabled={paying || !selected}>
          {paying ? 'Gerando PIX...' : '💳 Pagar com PIX'}
        </button>
      ) : (
        <div className="card">
          <div className="card-title">Pagamento PIX</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Plano: <strong>{pix.plan.name}</strong> — R$ {pix.amount.toFixed(2).replace('.', ',')}
          </div>
          <div className="result-block">
            <div className="result-block-label">Código PIX Copia e Cola</div>
            <div className="result-block-text" style={{ wordBreak: 'break-all', fontSize: 13 }}>
              {pix.pixCode}
            </div>
          </div>
          <button className="btn btn-outline mt-8 mb-16" onClick={copyPix}>
            📋 Copiar código PIX
          </button>
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            ⚠️ Em produção o pagamento é confirmado automaticamente. No MVP, clique abaixo para simular.
          </div>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={paying}>
            {paying ? 'Confirmando...' : '✅ Confirmar pagamento (simulado)'}
          </button>
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
        Todos os planos incluem orientação fiscal, base legal e informações complementares automáticas.
      </div>
    </div>
  );
}
