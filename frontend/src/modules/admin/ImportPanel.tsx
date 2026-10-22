import React, { useState } from 'react';
import { importApi, ImportRelatorio } from '../../api/client';

/**
 * Importacao em duas etapas: primeiro o relatorio (sem gravar), depois o apply
 * com o mesmo arquivo. Ninguem aplica uma planilha sem ver o efeito antes.
 */
export const ImportPanel: React.FC<{ onAplicado: () => void }> = ({ onAplicado }) => {
  const [tipo, setTipo] = useState<'ficha' | 'localizacao'>('ficha');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [relatorio, setRelatorio] = useState<ImportRelatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarErros, setMostrarErros] = useState(false);

  const analisar = async () => {
    if (!arquivo) {
      setErro('Escolha o arquivo .xlsx');
      return;
    }
    setCarregando(true);
    setErro('');
    setRelatorio(null);
    try {
      setRelatorio(await importApi.preview(tipo, arquivo));
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao ler a planilha');
    } finally {
      setCarregando(false);
    }
  };

  const aplicar = async () => {
    if (!arquivo) return;
    setCarregando(true);
    setErro('');
    try {
      const resultado = await importApi.apply(tipo, arquivo);
      setRelatorio(resultado);
      onAplicado();
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao aplicar a planilha');
    } finally {
      setCarregando(false);
    }
  };

  const limpar = () => {
    setArquivo(null);
    setRelatorio(null);
    setErro('');
    setMostrarErros(false);
  };

  const podeAplicar = relatorio && !relatorio.aplicado && relatorio.validas > 0;

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <h3 style={{ marginBottom: '4px' }}>Importar planilhas</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
        Fichas tecnicas trazem EAN13 e DUN14; a planilha de localizacao traz o endereco.
        Nada e gravado antes de voce clicar em Aplicar.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
          <label className="form-label">Tipo de planilha</label>
          <select
            className="input"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as 'ficha' | 'localizacao');
              setRelatorio(null);
            }}
          >
            <option value="ficha">Ficha tecnica (EAN13 / DUN14)</option>
            <option value="localizacao">Localizacao (endereco)</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '260px' }}>
          <label className="form-label">Arquivo</label>
          <input
            type="file"
            accept=".xlsx"
            className="input"
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              setRelatorio(null);
            }}
          />
        </div>

        <button className="btn btn-secondary" onClick={analisar} disabled={carregando || !arquivo}>
          {carregando && !relatorio ? 'Lendo...' : 'Analisar'}
        </button>

        {podeAplicar && (
          <button className="btn btn-primary" onClick={aplicar} disabled={carregando}>
            {carregando ? 'Aplicando...' : `Aplicar ${relatorio!.validas} linhas`}
          </button>
        )}

        {(relatorio || arquivo) && (
          <button className="btn btn-secondary" onClick={limpar} disabled={carregando}>
            Limpar
          </button>
        )}
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

      {relatorio && (
        <div style={{ marginTop: '18px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
            marginBottom: '14px'
          }}>
            {[
              ['Linhas lidas', relatorio.linhas_lidas, '#fff'],
              ['Aplicaveis', relatorio.validas, 'var(--primary)'],
              ['Sem alteracao', relatorio.sem_alteracao, 'var(--text-muted)'],
              ['Rejeitadas', relatorio.rejeitadas, relatorio.rejeitadas ? 'var(--warning)' : 'var(--text-muted)'],
              ['Nao encontradas', relatorio.nao_encontradas, relatorio.nao_encontradas ? 'var(--danger)' : 'var(--text-muted)'],
              ['Divergencias', relatorio.divergencias.length, relatorio.divergencias.length ? 'var(--warning)' : 'var(--text-muted)'],
            ].map(([rotulo, valor, cor]) => (
              <div key={String(rotulo)} style={{ background: '#090d16', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  {rotulo}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: cor as string }}>{valor}</div>
              </div>
            ))}
          </div>

          {relatorio.aplicado && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid var(--success)',
              color: '#6ee7b7',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '12px',
              fontSize: '0.85rem'
            }}>
              Aplicado: {relatorio.gravados ?? 0} registros gravados
              {relatorio.status ? ` (status ${relatorio.status})` : ''}. O resultado ficou registrado
              no historico de execucoes.
            </div>
          )}

          {relatorio.divergencias.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--warning)', fontWeight: 700, marginBottom: '6px' }}>
                Divergencias de quantidade (o ERP prevalece, nada foi alterado)
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxHeight: '140px', overflow: 'auto' }}>
                {relatorio.divergencias.slice(0, 30).map((d, i) => (
                  <div key={i}>
                    {d.chave}: planilha {d.planilha} · ERP {d.atual}
                  </div>
                ))}
                {relatorio.divergencias.length > 30 && <div>... e mais {relatorio.divergencias.length - 30}</div>}
              </div>
            </div>
          )}

          {relatorio.amostra.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                Amostra do que muda
              </p>
              <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>
                {relatorio.amostra.map((a, i) => (
                  <div key={i}>
                    {a.chave}: {JSON.stringify(a.antes)} → {JSON.stringify(a.depois)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {relatorio.erros.length > 0 && (
            <div>
              <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setMostrarErros(!mostrarErros)}>
                {mostrarErros ? 'Ocultar' : 'Ver'} {relatorio.erros.length} linhas com problema
              </button>
              {mostrarErros && (
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#fca5a5', maxHeight: '200px', overflow: 'auto' }}>
                  {relatorio.erros.slice(0, 100).map((e, i) => (
                    <div key={i}>linha {e.linha} · {e.chave || '-'}: {e.motivo}</div>
                  ))}
                  {relatorio.erros.length > 100 && <div>... e mais {relatorio.erros.length - 100}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
