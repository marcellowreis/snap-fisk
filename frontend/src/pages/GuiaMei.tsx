import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// OPERAÇÕES PERMITIDAS PARA MEI (CRT=4) — NT 2024.001 v1.20
// Vigente em produção desde 01/04/2025
// Regra N12a-90 da SEFAZ
// ═══════════════════════════════════════════════════════════════

const OPERACOES_MEI = [
  {
    id: 'venda-interna',
    icon: '🛒',
    titulo: 'Venda Interna',
    subtitulo: 'Mesmo estado',
    cfop: '5.102',
    csosn: '102',
    cor: '#6366f1',
    corBg: 'rgba(99,102,241,0.1)',
    corBorder: 'rgba(99,102,241,0.3)',
    descricao: 'Venda de mercadoria para cliente no mesmo estado.',
    exemplos: ['Venda para pessoa física local', 'Venda para empresa do mesmo estado'],
    permitido: true,
  },
  {
    id: 'venda-interestadual',
    icon: '🚚',
    titulo: 'Venda Interestadual',
    subtitulo: 'Outro estado',
    cfop: '6.102 / 6.108',
    csosn: '102',
    cor: '#8b5cf6',
    corBg: 'rgba(139,92,246,0.1)',
    corBorder: 'rgba(139,92,246,0.3)',
    descricao: 'Venda para cliente em outro estado. Sistema ajusta CFOP automaticamente.',
    exemplos: ['Venda para PF em outro estado (6.108)', 'Venda para empresa em outro estado (6.102)'],
    permitido: true,
  },
  {
    id: 'devolucao-venda',
    icon: '↩️',
    titulo: 'Devolução de Venda',
    subtitulo: 'Cliente devolvendo',
    cfop: '1.202 / 2.202',
    csosn: '900',
    cor: '#f59e0b',
    corBg: 'rgba(245,158,11,0.1)',
    corBorder: 'rgba(245,158,11,0.3)',
    descricao: 'Entrada de mercadoria devolvida pelo cliente.',
    exemplos: ['Retorno por defeito', 'Devolução por troca'],
    permitido: true,
  },
  {
    id: 'devolucao-saida',
    icon: '📤',
    titulo: 'Devolução ao Fornecedor',
    subtitulo: 'Devolvendo compra',
    cfop: '5.202 / 6.202',
    csosn: '900',
    cor: '#f59e0b',
    corBg: 'rgba(245,158,11,0.1)',
    corBorder: 'rgba(245,158,11,0.3)',
    descricao: 'Devolução de mercadoria comprada ao fornecedor.',
    exemplos: ['Devolução por defeito ao fornecedor', 'Mercadoria incorreta'],
    permitido: true,
  },
  {
    id: 'remessa-venda-externa',
    icon: '🏪',
    titulo: 'Remessa para Venda',
    subtitulo: 'Fora do estabelecimento',
    cfop: '5.904 / 6.904',
    csosn: '900',
    cor: '#10b981',
    corBg: 'rgba(16,185,129,0.1)',
    corBorder: 'rgba(16,185,129,0.3)',
    descricao: 'Remessa de mercadoria para venda em feiras, eventos ou por vendedor externo.',
    exemplos: ['Venda em feiras e exposições', 'Vendedor ambulante', 'Stand externo'],
    permitido: true,
  },
  {
    id: 'retorno-remessa',
    icon: '🔄',
    titulo: 'Retorno de Remessa',
    subtitulo: 'Mercadoria que voltou',
    cfop: '1.904 / 2.904',
    csosn: '900',
    cor: '#10b981',
    corBg: 'rgba(16,185,129,0.1)',
    corBorder: 'rgba(16,185,129,0.3)',
    descricao: 'Retorno de mercadoria que foi remetida para venda e não foi vendida.',
    exemplos: ['Retorno de estande de feira', 'Mercadoria não vendida pelo representante'],
    permitido: true,
  },
  {
    id: 'servico-issqn',
    icon: '🔧',
    titulo: 'Serviço (ISSQN)',
    subtitulo: 'Nota fiscal conjugada',
    cfop: '5.933',
    csosn: '900',
    cor: '#06b6d4',
    corBg: 'rgba(6,182,212,0.1)',
    corBorder: 'rgba(6,182,212,0.3)',
    descricao: 'Prestação de serviço com cobrança de ISSQN junto com mercadoria (nota conjugada).',
    exemplos: ['Manutenção com peças', 'Instalação com venda de produto'],
    permitido: true,
  },
  // ─── BLOQUEADAS ───
  {
    id: 'conserto',
    icon: '🔨',
    titulo: 'Remessa para Conserto',
    subtitulo: 'CFOP 5.915',
    cfop: '5.915 / 6.915',
    csosn: '—',
    cor: '#ef4444',
    corBg: 'rgba(239,68,68,0.07)',
    corBorder: 'rgba(239,68,68,0.25)',
    descricao: 'Não permitido para MEI na NF-e modelo 55 desde 01/04/2025.',
    exemplos: ['Rejeição 337 na SEFAZ', 'CFOP fora da lista NT 2024.001'],
    permitido: false,
    motivo: 'NT 2024.001 — Regra N12a-90: CFOP 5.915 não está na lista de CFOPs permitidos para MEI.',
  },
  {
    id: 'bonificacao',
    icon: '🎁',
    titulo: 'Bonificação / Brinde',
    subtitulo: 'CFOP 5.910',
    cfop: '5.910 / 6.910',
    csosn: '—',
    cor: '#ef4444',
    corBg: 'rgba(239,68,68,0.07)',
    corBorder: 'rgba(239,68,68,0.25)',
    descricao: 'Não permitido para MEI na NF-e modelo 55 desde 01/04/2025.',
    exemplos: ['Rejeição 337 na SEFAZ', 'CFOP fora da lista NT 2024.001'],
    permitido: false,
    motivo: 'NT 2024.001 — Regra N12a-90: CFOP 5.910 não está na lista de CFOPs permitidos para MEI.',
  },
  {
    id: 'demonstracao',
    icon: '👁️',
    titulo: 'Demonstração',
    subtitulo: 'CFOP 5.912',
    cfop: '5.912 / 5.913',
    csosn: '—',
    cor: '#ef4444',
    corBg: 'rgba(239,68,68,0.07)',
    corBorder: 'rgba(239,68,68,0.25)',
    descricao: 'Não permitido para MEI na NF-e modelo 55 desde 01/04/2025.',
    exemplos: ['Rejeição 337 na SEFAZ', 'CFOP fora da lista NT 2024.001'],
    permitido: false,
    motivo: 'NT 2024.001 — Regra N12a-90: CFOP 5.912/5.913 não estão na lista de CFOPs permitidos para MEI.',
  },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function GuiaMei({ isOpen, onClose }: Props) {
  const [selectedOp, setSelectedOp] = useState<typeof OPERACOES_MEI[0] | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'permitidas' | 'bloqueadas'>('todos');

  if (!isOpen) return null;

  const permitidas = OPERACOES_MEI.filter(o => o.permitido);
  const bloqueadas = OPERACOES_MEI.filter(o => !o.permitido);
  const exibidas = filtro === 'todos' ? OPERACOES_MEI : filtro === 'permitidas' ? permitidas : bloqueadas;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 560px)',
        maxHeight: '88vh',
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.08) 100%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>⚡</span>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Guia de Operações MEI</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                NT 2024.001 v1.20 · Vigente em produção desde <strong>01/04/2025</strong>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{permitidas.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Permitidas</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{bloqueadas.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bloqueadas</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{OPERACOES_MEI.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
            </div>
          </div>

          {/* Alerta 2027 */}
          <div style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginTop: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📅</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: '#a5b4fc' }}>A partir de 04/01/2027:</strong> MEI (CRT=4) passará a ser obrigado
              a preencher os campos de <strong>IBS, CBS e cClassTrib</strong> na NF-e, conforme LC 214/2025 e NT 2025.002.
              O Snap Fisk será atualizado assim que a Nota Técnica específica para MEI for publicada.{' '}
              <a href="https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=gC9dFrBGbHk=" target="_blank" rel="noreferrer" style={{ color: '#a5b4fc' }}>
                Acompanhar NT →
              </a>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {(['todos', 'permitidas', 'bloqueadas'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: filtro === f ? 'none' : '1px solid var(--border)',
                  background: filtro === f
                    ? f === 'bloqueadas' ? '#ef4444' : f === 'permitidas' ? '#10b981' : '#6366f1'
                    : 'transparent',
                  color: filtro === f ? '#fff' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: filtro === f ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {f === 'todos' ? 'Todas' : f === 'permitidas' ? '✅ Permitidas' : '❌ Bloqueadas'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>

          {/* Card detalhe */}
          {selectedOp && (
            <div style={{
              background: selectedOp.corBg,
              border: `1px solid ${selectedOp.corBorder}`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 28 }}>{selectedOp.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{selectedOp.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedOp.descricao}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedOp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>CFOP: </span>
                  <strong style={{ color: selectedOp.cor }}>{selectedOp.cfop}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>CSOSN: </span>
                  <strong>{selectedOp.csosn}</strong>
                </div>
                <div style={{
                  borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                  background: selectedOp.permitido ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)',
                  color: selectedOp.permitido ? '#10b981' : '#ef4444',
                }}>
                  {selectedOp.permitido ? '✅ Permitida' : '❌ Bloqueada (Rej. 337)'}
                </div>
              </div>

              {!selectedOp.permitido && selectedOp.motivo && (
                <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                  ⚠️ {selectedOp.motivo}
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>Exemplos:</div>
                {selectedOp.exemplos.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 2 }}>
                    <span style={{ color: selectedOp.cor }}>›</span>
                    <span>{ex}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid de cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exibidas.map(op => (
              <button
                key={op.id}
                onClick={() => setSelectedOp(selectedOp?.id === op.id ? null : op)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  background: selectedOp?.id === op.id ? op.corBg : 'var(--bg)',
                  border: `1px solid ${selectedOp?.id === op.id ? op.cor : 'var(--border)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s',
                  opacity: op.permitido ? 1 : 0.8,
                }}
              >
                {/* Ícone */}
                <div style={{
                  width: 42, height: 42,
                  borderRadius: 10,
                  background: op.corBg,
                  border: `1px solid ${op.corBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}>
                  {op.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{op.titulo}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: op.permitido ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                      color: op.permitido ? '#10b981' : '#ef4444',
                    }}>
                      {op.permitido ? '✓ OK' : '✗ Rej.337'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{op.subtitulo}</div>
                </div>

                {/* CFOP */}
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: op.cor,
                  fontFamily: 'monospace',
                  flexShrink: 0,
                  background: op.corBg,
                  border: `1px solid ${op.corBorder}`,
                  borderRadius: 6,
                  padding: '3px 8px',
                }}>
                  {op.cfop.split(' / ')[0]}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.1)',
        }}>
          <a
            href="https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY="
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: 'var(--primary-light)', textDecoration: 'none' }}
          >
            📄 Ver NT 2024.001 completa →
          </a>
          <button
            onClick={onClose}
            className="btn btn-outline btn-sm"
            style={{ fontSize: 12 }}
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}
