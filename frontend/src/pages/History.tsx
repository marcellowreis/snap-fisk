import { useState, useEffect } from 'react';
import { api } from '../api';

export default function History() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/fiscal-engine/history')
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (date: string) =>
    new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📂</div>
        <div className="empty-title">Nenhuma consulta ainda</div>
        <p>Faça sua primeira consulta fiscal na aba "Nova NF".</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card-title">Histórico de Consultas</div>
      {items.map(item => (
        <div key={item.id} className="history-item">
          <div className="history-header">
            <div className="history-cfop">{item.cfop ?? '—'}</div>
            <div className="history-date">{fmt(item.createdAt)}</div>
          </div>
          <div className="history-info">
            {item.operation} · {item.purpose} · {item.originUf}→{item.destinationUf}
          </div>
          {item.naturezaOperacao && (
            <div className="mt-8" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {item.naturezaOperacao}
            </div>
          )}
          {item.cstCsosn && (
            <div className="mt-8">
              <span className="badge badge-success">CSOSN {item.cstCsosn}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
