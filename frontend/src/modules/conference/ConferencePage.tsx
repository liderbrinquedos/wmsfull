import React, { useState, useEffect } from 'react';
import { NotaFiscal, conferenceApi } from '../../api/client';
import { ConferenceSession } from './ConferenceSession';

export const ConferencePage: React.FC = () => {
  const [nfs, setNfs] = useState<NotaFiscal[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeNf, setActiveNf] = useState<NotaFiscal | null>(null);

  const loadNFs = async () => {
    try {
      setLoading(true);
      const data = await conferenceApi.getNFs(filterStatus || undefined);
      setNfs(data);
    } catch (err) {
      console.error('Erro ao listar NFs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNFs();
  }, [filterStatus]);

  const handleStartConference = async (nf: NotaFiscal) => {
    if (nf.status === 'pendente') {
      try {
        const started = await conferenceApi.start(nf.id);
        setActiveNf(started);
        return;
      } catch (err) {
        console.error('Erro ao iniciar conferência:', err);
      }
    }
    setActiveNf(nf);
  };

  if (activeNf) {
    return (
      <ConferenceSession
        nf={activeNf}
        onBack={() => {
          setActiveNf(null);
          loadNFs();
        }}
        onRefresh={(updated) => {
          setActiveNf(updated);
          setNfs((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>🔍 Módulo 2 — Conferência de Carga & Nota Fiscal</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Conferência por leitura de código de barras da caixa master com cálculo automático por quantidade de embalagem
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Todas', value: '' },
          { label: 'Pendentes', value: 'pendente' },
          { label: 'Em Conferência', value: 'em_conferencia' },
          { label: 'Conferidas', value: 'conferida' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`btn ${filterStatus === tab.value ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '8px 14px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Carregando notas fiscais...
        </div>
      ) : nfs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Nenhuma nota fiscal encontrada para o filtro selecionado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {nfs.map((nf) => {
            const totalCaixas = nf.itens.reduce((acc, i) => acc + i.caixas_necessarias, 0);
            const caixasLidas = nf.itens.reduce((acc, i) => acc + i.caixas_lidas, 0);

            return (
              <div key={nf.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>{nf.numero}</h3>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        Emp. {nf.codigo_empresa}{nf.serie ? ` · Série ${nf.serie}` : ''}
                      </span>
                      <span className={`badge badge-${nf.status}`}>
                        {nf.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div style={{ marginTop: '6px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                      Cliente: <strong style={{ color: '#fff' }}>{nf.cliente}</strong>
                      {nf.cnpj_cliente && <span> · CNPJ: {nf.cnpj_cliente}</span>}
                    </div>

                    <div style={{ marginTop: '4px', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      {nf.endereco || 'Endereço não informado'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Progresso</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: caixasLidas === totalCaixas ? 'var(--success)' : 'var(--primary)' }}>
                        {caixasLidas} / {totalCaixas} caixas
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartConference(nf)}
                      className={`btn ${nf.status === 'pendente' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                    >
                      {nf.status === 'pendente' && '▶ Iniciar Conferência'}
                      {nf.status === 'em_conferencia' && '⚡ Continuar Bipando'}
                      {nf.status === 'conferida' && '✓ Ver / Atribuir Motorista'}
                      {['em_entrega', 'entregue', 'reagendado'].includes(nf.status) && '👁 Visualizar Itens'}
                    </button>
                  </div>
                </div>

                {/* Resumo dos itens da NF */}
                <div style={{
                  marginTop: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  {nf.itens.map((i) => (
                    <div
                      key={i.id}
                      style={{
                        background: '#090d16',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{ color: i.conferido ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                        {i.conferido ? '✓' : '○'}
                      </span>
                      <span>{i.produto?.descricao || `Item ${i.product_id}`}:</span>
                      <strong>{i.caixas_lidas}/{i.caixas_necessarias} cx</strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
