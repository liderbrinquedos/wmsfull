import React, { useState, useEffect } from 'react';
import { NotaFiscal, deliveryApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { DeliveryModal } from './DeliveryModal';

export const DeliveryPage: React.FC = () => {
  const [nfs, setNfs] = useState<NotaFiscal[]>([]);
  const [selectedNf, setSelectedNf] = useState<NotaFiscal | null>(null);
  const [filter, setFilter] = useState<'all' | 'em_entrega' | 'entregue' | 'reagendado'>('em_entrega');
  const [loading, setLoading] = useState(true);

  const { user } = useAuthStore();

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      const data = await deliveryApi.getMyNFs();
      setNfs(data);
    } catch (err) {
      console.error('Erro ao carregar entregas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  const filteredNfs = nfs.filter((nf) => {
    if (filter === 'all') return true;
    return nf.status === filter;
  });

  const countPending = nfs.filter((n) => n.status === 'em_entrega').length;
  const countDone = nfs.filter((n) => n.status === 'entregue').length;
  const countRescheduled = nfs.filter((n) => n.status === 'reagendado').length;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>🚚 Módulo 3 — Fila de Entregas</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {user?.perfil === 'motorista'
            ? `Olá, ${user.nome}! Confira sua rota e dê baixa nas entregas.`
            : 'Visão operacional de rotas de entrega atribuídas aos motoristas.'}
        </p>
      </div>

      {/* KPI Counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <div
          onClick={() => setFilter('em_entrega')}
          className="card"
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            border: filter === 'em_entrega' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
            background: filter === 'em_entrega' ? '#162238' : 'var(--bg-card)'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            A Entregar
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
            {countPending}
          </div>
        </div>

        <div
          onClick={() => setFilter('entregue')}
          className="card"
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            border: filter === 'entregue' ? '1px solid var(--success)' : '1px solid var(--border-color)',
            background: filter === 'entregue' ? '#0f291e' : 'var(--bg-card)'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Entregues
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>
            {countDone}
          </div>
        </div>

        <div
          onClick={() => setFilter('reagendado')}
          className="card"
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            border: filter === 'reagendado' ? '1px solid var(--danger)' : '1px solid var(--border-color)',
            background: filter === 'reagendado' ? '#2d1515' : 'var(--bg-card)'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Reagendadas
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>
            {countRescheduled}
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Carregando notas de entrega...
        </div>
      ) : filteredNfs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Nenhuma nota fiscal encontrada nesta categoria.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredNfs.map((nf) => {
            const totalCaixas = nf.itens.reduce((acc, i) => acc + i.caixas_necessarias, 0);

            return (
              <div key={nf.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>{nf.numero}</h3>
                      <span className={`badge badge-${nf.status}`}>
                        {nf.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Cliente</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                        {nf.cliente || 'Cliente Balcão'}
                      </div>
                    </div>

                    <div style={{ marginTop: '6px', fontSize: '0.9rem', color: '#94a3b8' }}>
                      📍 {nf.endereco || 'Endereço não cadastrado'}
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      Total de Carga: <strong style={{ color: '#fff' }}>{totalCaixas} caixas master</strong>
                      {nf.cnpj_cliente && <span> · CNPJ {nf.cnpj_cliente}</span>}
                    </div>

                    {user?.perfil !== 'motorista' && nf.motorista && (
                      <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#38bdf8' }}>
                        Motorista: <strong>{nf.motorista.nome}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px' }}>
                    {nf.status === 'em_entrega' && (
                      <button
                        onClick={() => setSelectedNf(nf)}
                        className="btn btn-primary"
                        style={{ padding: '14px', fontSize: '0.95rem', fontWeight: 700 }}
                      >
                        📦 Baixa na Entrega
                      </button>
                    )}

                    {nf.status === 'reagendado' && (
                      <button
                        onClick={() => setSelectedNf(nf)}
                        className="btn btn-secondary"
                        style={{ padding: '10px', fontSize: '0.85rem' }}
                      >
                        🔄 Tentar Novamente
                      </button>
                    )}

                    {nf.status === 'entregue' && (
                      <div style={{
                        textAlign: 'center',
                        padding: '10px',
                        background: 'var(--success-bg)',
                        border: '1px solid var(--success)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--success)',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}>
                        ✓ Entregue com Sucesso
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delivery Action Modal */}
      {selectedNf && (
        <DeliveryModal
          nf={selectedNf}
          onClose={() => setSelectedNf(null)}
          onSuccess={() => {
            loadDeliveries();
          }}
        />
      )}
    </div>
  );
};
