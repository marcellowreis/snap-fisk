import { useState, useEffect } from 'react';
import { api } from '../api';

export default function History() {
  const [tab, setTab] = useState<'nfe' | 'consultas'>('nfe');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/invoices'),
      api.get('/api/fiscal-engine/history'),
    ]).then(([inv, con]) => {
      setInvoices(inv);
      setConsultas(con);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const fmt = (date: string) =>
    new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const downloadXml = async (id: string, numero: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/invoices/${id}/xml`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${numero}.xml`;
    a.click();
  };

  const statusColor: Record<string, string> = {
    RASCUNHO: 'var(--text-muted)',
    GERADO: 'var(--warning)',
    AUTORIZADO: 'var(--success)',
    CANCELADO: 'var(--danger)',
    REJEITADO: 'var(--danger)',
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ v: 'nfe', l: '📄 NF-e Emitidas' }, { v: 'consultas', l: '🔍 Consultas' }].map(t => (
          <button key={t.v} className={`btn ${tab === t.v ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setTab(t.v as any)}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'nfe' && (
        invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <div className="empty-title">Nenhuma NF-e emitida ainda</div>
            <p>Vá em "Emitir NF" para criar sua primeira nota.</p>
          </div>
        ) : invoices.map(inv => (
          <div key={inv.id} className="history-item">
            <div className="history-header">
              <div>
                <div className="history-cfop">NF {inv.numero}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Série {inv.serie} · CFOP {inv.cfop}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: statusColor[inv.status] || 'var(--text-muted)' }}>{inv.status}</div>
                <div className="history-date">{fmt(inv.createdAt)}</div>
              </div>
            </div>
            <div className="history-info">
              {inv.customer ? inv.customer.nome : 'Sem destinatário'} · {inv.tpNF === '1' ? 'Saída' : 'Entrada'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-light)' }}>
                R$ {inv.vTotal?.toFixed(2).replace('.', ',')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {inv.xmlGerado && (
                  <button className="btn btn-outline btn-sm" onClick={() => downloadXml(inv.id, inv.numero)}>
                    📥 XML
                  </button>
                )}
              </div>
            </div>
            {inv.items?.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {inv.items.length} item(s): {inv.items.map((i: any) => i.xProd).join(', ')}
              </div>
            )}
          </div>
        ))
      )}

      {tab === 'consultas' && (
        consultas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">Nenhuma consulta ainda</div>
            <p>Consulte o motor fiscal na aba "Consultar".</p>
          </div>
        ) : consultas.map(item => (
          <div key={item.id} className="history-item">
            <div className="history-header">
              <div className="history-cfop">{item.cfop ?? '—'}</div>
              <div className="history-date">{fmt(item.createdAt)}</div>
            </div>
            <div className="history-info">
              {item.operation} · {item.purpose} · {item.originUf}→{item.destinationUf}
            </div>
            {item.naturezaOperacao && (
              <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>{item.naturezaOperacao}</div>
            )}
            {item.cstCsosn && (
              <div className="mt-8">
                <span className="badge badge-success">CSOSN {item.cstCsosn}</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
