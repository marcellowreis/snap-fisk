import { useState, useMemo } from 'react';

// Tabela oficial de CFOPs da Receita Federal
// Fonte: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/facilitacao/anexo-ecf-cfop
// Atualizada em: 15/06/2023

const CFOP_DATA = [
  // ── SAÍDAS INTERNAS (5xxx) ──────────────────────────────
  { cfop: '5101', desc: 'Venda de produção do estabelecimento', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5102', desc: 'Venda de mercadoria adquirida ou recebida de terceiros', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5103', desc: 'Venda de produção do estabelecimento, efetuada fora do estabelecimento', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5104', desc: 'Venda de mercadoria adquirida ou recebida de terceiros, efetuada fora do estabelecimento', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5109', desc: 'Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5110', desc: 'Venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5116', desc: 'Venda de produção do estabelecimento originada de encomenda para entrega futura', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5117', desc: 'Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda para entrega futura', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5118', desc: 'Venda de produção do estabelecimento entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5119', desc: 'Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5124', desc: 'Industrialização efetuada para outra empresa', grupo: 'Vendas internas', tipo: 'saida' },
  { cfop: '5401', desc: 'Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária, na condição de contribuinte substituto', grupo: 'Substituição tributária interna', tipo: 'saida' },
  { cfop: '5403', desc: 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituto', grupo: 'Substituição tributária interna', tipo: 'saida' },
  { cfop: '5405', desc: 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituído', grupo: 'Substituição tributária interna', tipo: 'saida' },
  { cfop: '5501', desc: 'Remessa de produção do estabelecimento, com fim específico de exportação', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5502', desc: 'Remessa de mercadoria adquirida ou recebida de terceiros, com fim específico de exportação', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5904', desc: 'Remessa para venda fora do estabelecimento', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5905', desc: 'Remessa para depósito fechado, armazém geral ou outro estabelecimento', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5910', desc: 'Remessa em bonificação, doação ou brinde', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5915', desc: 'Remessa de mercadoria ou bem para conserto ou reparo', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5916', desc: 'Retorno de mercadoria ou bem recebido para conserto ou reparo', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5922', desc: 'Lançamento efetuado a título de simples faturamento decorrente de venda para entrega futura', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5929', desc: 'Lançamento efetuado em decorrência de emissão de documento fiscal relativo a operação ou prestação também acobertada por documento fiscal emitido por sistema diferente', grupo: 'Remessas internas', tipo: 'saida' },
  { cfop: '5933', desc: 'Prestação de serviço tributado pelo ISSQN', grupo: 'Serviços internos', tipo: 'saida' },
  { cfop: '5949', desc: 'Outra saída de mercadoria ou prestação de serviço não especificado', grupo: 'Outras saídas internas', tipo: 'saida' },

  // ── SAÍDAS INTERESTADUAIS (6xxx) ───────────────────────
  { cfop: '6101', desc: 'Venda de produção do estabelecimento', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6102', desc: 'Venda de mercadoria adquirida ou recebida de terceiros', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6107', desc: 'Venda de produção do estabelecimento, destinada a não contribuinte', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6108', desc: 'Venda de mercadoria adquirida ou recebida de terceiros, destinada a não contribuinte', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6109', desc: 'Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6110', desc: 'Venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6116', desc: 'Venda de produção do estabelecimento originada de encomenda para entrega futura', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6117', desc: 'Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda para entrega futura', grupo: 'Vendas interestaduais', tipo: 'saida' },
  { cfop: '6401', desc: 'Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária, na condição de contribuinte substituto', grupo: 'Substituição tributária interestadual', tipo: 'saida' },
  { cfop: '6403', desc: 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituto', grupo: 'Substituição tributária interestadual', tipo: 'saida' },
  { cfop: '6404', desc: 'Venda de mercadoria sujeita ao regime de substituição tributária, cujo imposto já tenha sido retido anteriormente', grupo: 'Substituição tributária interestadual', tipo: 'saida' },
  { cfop: '6501', desc: 'Remessa de produção do estabelecimento, com fim específico de exportação', grupo: 'Remessas interestaduais', tipo: 'saida' },
  { cfop: '6502', desc: 'Remessa de mercadoria adquirida ou recebida de terceiros, com fim específico de exportação', grupo: 'Remessas interestaduais', tipo: 'saida' },
  { cfop: '6904', desc: 'Remessa para venda fora do estabelecimento', grupo: 'Remessas interestaduais', tipo: 'saida' },
  { cfop: '6910', desc: 'Remessa em bonificação, doação ou brinde', grupo: 'Remessas interestaduais', tipo: 'saida' },
  { cfop: '6915', desc: 'Remessa de mercadoria ou bem para conserto ou reparo', grupo: 'Remessas interestaduais', tipo: 'saida' },
  { cfop: '6916', desc: 'Retorno de mercadoria ou bem recebido para conserto ou reparo', grupo: 'Remessas interestaduais', tipo: 'saida' },
  { cfop: '6933', desc: 'Prestação de serviço tributado pelo ISSQN', grupo: 'Serviços interestaduais', tipo: 'saida' },
  { cfop: '6949', desc: 'Outra saída de mercadoria ou prestação de serviço não especificado', grupo: 'Outras saídas interestaduais', tipo: 'saida' },

  // ── SAÍDAS EXPORTAÇÃO (7xxx) ────────────────────────────
  { cfop: '7101', desc: 'Venda de produção do estabelecimento', grupo: 'Exportação', tipo: 'saida' },
  { cfop: '7102', desc: 'Venda de mercadoria adquirida ou recebida de terceiros', grupo: 'Exportação', tipo: 'saida' },
  { cfop: '7105', desc: 'Venda de produção do estabelecimento, que não deva por ele transitar', grupo: 'Exportação', tipo: 'saida' },
  { cfop: '7106', desc: 'Venda de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar', grupo: 'Exportação', tipo: 'saida' },
  { cfop: '7501', desc: 'Exportação de mercadorias recebidas com fim específico de exportação', grupo: 'Exportação', tipo: 'saida' },
  { cfop: '7504', desc: 'Exportação de mercadoria que foi objeto de formação de lote de exportação', grupo: 'Exportação', tipo: 'saida' },

  // ── ENTRADAS INTERNAS (1xxx) ────────────────────────────
  { cfop: '1101', desc: 'Compra para industrialização ou produção rural', grupo: 'Compras internas', tipo: 'entrada' },
  { cfop: '1102', desc: 'Compra para comercialização', grupo: 'Compras internas', tipo: 'entrada' },
  { cfop: '1113', desc: 'Compra para comercialização, de mercadoria recebida anteriormente em consignação mercantil', grupo: 'Compras internas', tipo: 'entrada' },
  { cfop: '1116', desc: 'Compra para industrialização ou produção rural originada de encomenda para recebimento futuro', grupo: 'Compras internas', tipo: 'entrada' },
  { cfop: '1117', desc: 'Compra para comercialização, originada de encomenda para recebimento futuro', grupo: 'Compras internas', tipo: 'entrada' },
  { cfop: '1201', desc: 'Devolução de venda de produção do estabelecimento', grupo: 'Devoluções internas', tipo: 'entrada' },
  { cfop: '1202', desc: 'Devolução de venda de mercadoria adquirida ou recebida de terceiros', grupo: 'Devoluções internas', tipo: 'entrada' },
  { cfop: '1401', desc: 'Compra para industrialização em operação com mercadoria sujeita ao regime de substituição tributária', grupo: 'ST interna entrada', tipo: 'entrada' },
  { cfop: '1403', desc: 'Compra para comercialização em operação com mercadoria sujeita ao regime de substituição tributária', grupo: 'ST interna entrada', tipo: 'entrada' },
  { cfop: '1556', desc: 'Compra de material para uso ou consumo', grupo: 'Compras internas', tipo: 'entrada' },
  { cfop: '1904', desc: 'Retorno de remessa para venda fora do estabelecimento', grupo: 'Retornos internos', tipo: 'entrada' },
  { cfop: '1910', desc: 'Entrada de bonificação, doação ou brinde', grupo: 'Retornos internos', tipo: 'entrada' },
  { cfop: '1915', desc: 'Entrada de mercadoria ou bem recebido para conserto ou reparo', grupo: 'Retornos internos', tipo: 'entrada' },
  { cfop: '1916', desc: 'Retorno de mercadoria ou bem remetido para conserto ou reparo', grupo: 'Retornos internos', tipo: 'entrada' },
  { cfop: '1949', desc: 'Outra entrada de mercadoria ou prestação de serviço não especificado', grupo: 'Outras entradas internas', tipo: 'entrada' },

  // ── ENTRADAS INTERESTADUAIS (2xxx) ─────────────────────
  { cfop: '2101', desc: 'Compra para industrialização ou produção rural', grupo: 'Compras interestaduais', tipo: 'entrada' },
  { cfop: '2102', desc: 'Compra para comercialização', grupo: 'Compras interestaduais', tipo: 'entrada' },
  { cfop: '2201', desc: 'Devolução de venda de produção do estabelecimento', grupo: 'Devoluções interestaduais', tipo: 'entrada' },
  { cfop: '2202', desc: 'Devolução de venda de mercadoria adquirida ou recebida de terceiros', grupo: 'Devoluções interestaduais', tipo: 'entrada' },
  { cfop: '2556', desc: 'Compra de material para uso ou consumo', grupo: 'Compras interestaduais', tipo: 'entrada' },
  { cfop: '2904', desc: 'Retorno de remessa para venda fora do estabelecimento', grupo: 'Retornos interestaduais', tipo: 'entrada' },
  { cfop: '2910', desc: 'Entrada de bonificação, doação ou brinde', grupo: 'Retornos interestaduais', tipo: 'entrada' },
  { cfop: '2915', desc: 'Entrada de mercadoria ou bem recebido para conserto ou reparo', grupo: 'Retornos interestaduais', tipo: 'entrada' },
  { cfop: '2916', desc: 'Retorno de mercadoria ou bem remetido para conserto ou reparo', grupo: 'Retornos interestaduais', tipo: 'entrada' },
  { cfop: '2949', desc: 'Outra entrada de mercadoria ou prestação de serviço não especificado', grupo: 'Outras entradas interestaduais', tipo: 'entrada' },

  // ── ENTRADAS IMPORTAÇÃO (3xxx) ──────────────────────────
  { cfop: '3101', desc: 'Compra para industrialização ou produção rural', grupo: 'Importação', tipo: 'entrada' },
  { cfop: '3102', desc: 'Compra para comercialização', grupo: 'Importação', tipo: 'entrada' },
  { cfop: '3201', desc: 'Devolução de venda de produção do estabelecimento', grupo: 'Importação', tipo: 'entrada' },
  { cfop: '3202', desc: 'Devolução de venda de mercadoria adquirida ou recebida de terceiros', grupo: 'Importação', tipo: 'entrada' },
  { cfop: '3556', desc: 'Compra de material para uso ou consumo', grupo: 'Importação', tipo: 'entrada' },
];

// CFOPs permitidos para MEI (CRT=4) conforme NT 2024.001
const MEI_ALLOWED = new Set([
  '5102','6102','5101','6101',
  '1202','2202','5202','6202',
  '5904','6904','1904','2904',
  '5910','6910','1910','2910',
  '5915','6915','1915','2915',
  '1916','2916','5916','6916',
  '5949','6949','1949','2949',
]);

export default function Cfop() {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'saida' | 'entrada'>('todos');
  const [apenasNei, setApenasMei] = useState(false);

  const resultado = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return CFOP_DATA.filter(item => {
      const matchBusca = !termo ||
        item.cfop.includes(termo) ||
        item.desc.toLowerCase().includes(termo) ||
        item.grupo.toLowerCase().includes(termo);
      const matchTipo = filtroTipo === 'todos' || item.tipo === filtroTipo;
      const matchMei = !apenasNei || MEI_ALLOWED.has(item.cfop);
      return matchBusca && matchTipo && matchMei;
    });
  }, [busca, filtroTipo, apenasNei]);

  const grupos = useMemo(() => {
    const map = new Map<string, typeof CFOP_DATA>();
    resultado.forEach(item => {
      if (!map.has(item.grupo)) map.set(item.grupo, []);
      map.get(item.grupo)!.push(item);
    });
    return map;
  }, [resultado]);

  return (
    <div>
      {/* Banner NT 2024.001 */}
      <div style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.35)',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 20,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--warning, #f59e0b)' }}>
            Atualização da NT 2024.001 v1_20
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            A partir de 01/04/2025, houve uma restrição nos CFOPs que o MEI pode usar, conforme a nova nota técnica.
            Ative o filtro <strong>"Somente MEI"</strong> para ver apenas os CFOPs permitidos para CRT=4.{' '}
            <a
              href="https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY="
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--primary-light)', fontSize: 12 }}
            >
              Ver NT completa →
            </a>
          </div>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>📋 Consultar CFOP</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Fonte: Receita Federal · Atualizado em 15/06/2023 ·{' '}
              <a
                href="https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/facilitacao/anexo-ecf-cfop"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--primary-light)' }}
              >
                Ver fonte oficial →
              </a>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
            {resultado.length} CFOPs encontrados
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="form-input"
            placeholder="🔍  Buscar por código, descrição ou grupo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['todos', 'saida', 'entrada'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={filtroTipo === t ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              >
                {t === 'todos' ? 'Todos' : t === 'saida' ? '↑ Saída (5,6,7)' : '↓ Entrada (1,2,3)'}
              </button>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={apenasNei}
                onChange={e => setApenasMei(e.target.checked)}
              />
              Somente MEI (CRT=4)
            </label>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {resultado.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          Nenhum CFOP encontrado para "{busca}"
        </div>
      ) : (
        [...grupos.entries()].map(([grupo, items]) => (
          <div key={grupo} className="card" style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid var(--border)',
            }}>
              {grupo}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {items.map(item => (
                <div
                  key={item.cfop}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '8px 4px',
                    borderRadius: 6,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{
                    minWidth: 52,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--primary-light)',
                    flexShrink: 0,
                  }}>
                    {item.cfop}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>
                    {item.desc}
                  </div>
                  {MEI_ALLOWED.has(item.cfop) && (
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#10b981',
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      MEI ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Rodapé */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', paddingBottom: 24, marginTop: 8 }}>
        Dados conforme tabela ECF-CFOP da Receita Federal. Para a lista completa, acesse{' '}
        <a
          href="https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/facilitacao/anexo-ecf-cfop"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--primary-light)' }}
        >
          gov.br/receitafederal
        </a>
      </div>
    </div>
  );
}
