import React, { useCallback, useEffect, useState } from 'react';
import { syncApi, SyncRunResumo, SyncStatus } from '../../api/client';
import { ImportPanel } from './ImportPanel';

const ROTULO_TIPO: Record<string, string> = {
  erp: 'ERP',
  ficha: 'Fichas tecnicas (EAN)',
  localizacao: 'Planilha de localizacao',
};

const COR_STATUS: Record<string, string> = {
  ok: 'var(--success)',
  parcial: 'var(--warning)',
  erro: 'var(--danger)',
  executando: 'var(--primary)',
};

// A API grava utcnow() sem timezone. Sem o sufixo Z o navegador leria o horario
// como local e mostraria 3 horas a mais.
function comoData(iso: string | null): Date | null {
  if (!iso) return null;
  const temFuso = /[zZ]$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(temFuso ? iso : `${iso}Z`);
}

function quando(iso: string | null): string {
  const data = comoData(iso);
  if (!data) return 'nunca';
  const minutos = Math.round((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `ha ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `ha ${horas} h`;
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export const SyncPanel: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [runs, setRuns] = useState<SyncRunResumo[]>([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [detalheErros, setDetalheErros] = useState<
    Array<{ entidade: string; chave: string | null; motivo: string }>
  >([]);

  const carregar = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([syncApi.status(), syncApi.runs()]);
      setStatus(s);
      setRuns(r);
      setErro('');
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao consultar o status da sincronizacao');
    }
  }, []);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, 20000);
    return () => clearInterval(timer);
  }, [carregar]);

  const solicitar = async () => {
    setEnviando(true);
    setErro('');
    try {
      await syncApi.solicitar();
      await carregar();
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao solicitar sincronizacao');
    } finally {
      setEnviando(false);
    }
  };

  const abrirDetalhe = async (id: string) => {
    if (detalheId === id) {
      setDetalheId(null);
      return;
    }
    try {
      const d = await syncApi.run(id);
      setDetalheId(id);
      setDetalheErros(d.erros_detalhe);
    } catch (err) {
      setErro('Erro ao carregar o detalhe da execucao');
    }
  };

  const pedido = status?.pedido_pendente ?? null;

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ marginBottom: '4px' }}>Sincronizacao de dados</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              O agente interno envia os dados do ERP 3x por dia. O pedido manual e atendido em
              ate 2 minutos.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {pedido && (
              <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 700 }}>
                PEDIDO NA FILA ({quando(pedido.solicitado_em)})
              </span>
            )}
            <button
              className="btn btn-primary"
              onClick={solicitar}
              disabled={enviando || !!pedido}
              title={pedido ? 'Ja existe um pedido aguardando o agente' : 'Grava um pedido; o agente consulta a cada 2 min'}
            >
              {enviando ? 'Enviando...' : pedido ? 'Aguardando agente' : 'Sincronizar agora'}
            </button>
          </div>
        </div>

        {erro && (
          <div style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginTop: '14px',
            fontSize: '0.85rem'
          }}>
            {erro}
          </div>
        )}

        {status && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
            marginTop: '18px'
          }}>
            {Object.entries(status.ultima_por_tipo).map(([tipo, run]) => (
              <div key={tipo} style={{
                background: '#090d16',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                borderLeft: `4px solid ${run ? COR_STATUS[run.status] || 'var(--border-color)' : 'var(--border-color)'}`
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  {ROTULO_TIPO[tipo] || tipo}
                </span>
                {run ? (
                  <>
                    <div style={{ fontSize: '0.9rem', color: '#fff', marginTop: '6px' }}>
                      {run.gravados} registros · {run.erros} erros
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {run.status} · {quando(run.iniciado_em)} · {run.origem}
                    </div>
                    {run.mensagem && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '6px' }}>
                        {run.mensagem}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                    nenhuma execucao registrada
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '14px' }}>Ultimas execucoes</h3>
        {runs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Nenhuma execucao registrada. O agente ainda nao enviou dados.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {runs.map((run) => (
              <div key={run.id}>
                <button
                  type="button"
                  onClick={() => abrirDetalhe(run.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: '#090d16',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    color: 'inherit',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    fontSize: '0.85rem'
                  }}
                >
                  <span style={{ fontWeight: 700, color: COR_STATUS[run.status] || '#fff' }}>
                    {ROTULO_TIPO[run.tipo] || run.tipo} · {run.status}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {quando(run.iniciado_em)} · {run.origem} · {run.gravados}/{run.lidos} gravados
                    {run.erros > 0 && ` · ${run.erros} erros`}
                  </span>
                </button>

                {detalheId === run.id && (
                  <div style={{
                    margin: '6px 0 12px',
                    padding: '10px 12px',
                    background: 'rgba(14, 165, 233, 0.06)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem'
                  }}>
                    {detalheErros.length === 0 ? (
                      <span style={{ color: 'var(--success)' }}>Nenhum erro registrado nesta execucao.</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {detalheErros.map((item, indice) => (
                          <div key={indice} style={{ color: '#fca5a5' }}>
                            <strong>{item.entidade}</strong>
                            {item.chave ? ` ${item.chave}` : ''}: {item.motivo}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ImportPanel onAplicado={carregar} />
    </div>
  );
};
