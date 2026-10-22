import React, { useState, useRef, useEffect } from 'react';
import { NotaFiscal, Product, conferenceApi, adminApi, User } from '../../api/client';
import { LocationBadge } from '../wms/LocationBadge';

interface ConferenceSessionProps {
  nf: NotaFiscal;
  onBack: () => void;
  onRefresh: (updated: NotaFiscal) => void;
}

export const ConferenceSession: React.FC<ConferenceSessionProps> = ({ nf, onBack, onRefresh }) => {
  const [currentNf, setCurrentNf] = useState<NotaFiscal>(nf);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [motoristas, setMotoristas] = useState<User[]>([]);
  const [selectedMotorista, setSelectedMotorista] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus barcode input continuously
    inputRef.current?.focus();
    if (currentNf.status === 'conferida') {
      adminApi.getMotoristas().then(setMotoristas);
    }
  }, [currentNf.status]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setErrorMsg('');
    setSuccessMsg('');
    setIsScanning(true);

    try {
      const updated = await conferenceApi.scan(currentNf.id, barcodeInput.trim());
      setCurrentNf(updated);
      onRefresh(updated);
      setSuccessMsg(`Código ${barcodeInput.trim()} conferido com sucesso!`);
      setBarcodeInput('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Código de barras inválido ou item já conferido!');
    } finally {
      setIsScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleQuickScan = async (code: string) => {
    setBarcodeInput(code);
    setErrorMsg('');
    setSuccessMsg('');
    setIsScanning(true);
    try {
      const updated = await conferenceApi.scan(currentNf.id, code);
      setCurrentNf(updated);
      onRefresh(updated);
      setSuccessMsg(`Leitura registrada!`);
      setBarcodeInput('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Erro na leitura');
    } finally {
      setIsScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Codigo da CAIXA: ean14 (DUN14) e, como legado, o codigo master antigo.
  // Sem nenhum dos dois o produto nao pode ser bipado como caixa.
  const codigoCaixa = (produto?: Product) =>
    produto?.ean14 || produto?.codigo_barras_master || null;

  const handleAssignMotorista = async () => {
    if (!selectedMotorista) return;
    setIsAssigning(true);
    try {
      const updated = await conferenceApi.assignMotorista(currentNf.id, selectedMotorista);
      setCurrentNf(updated);
      onRefresh(updated);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Erro ao atribuir motorista');
    } finally {
      setIsAssigning(false);
    }
  };

  const totalCaixas = currentNf.itens.reduce((acc, i) => acc + i.caixas_necessarias, 0);
  const totalLidas = currentNf.itens.reduce((acc, i) => acc + i.caixas_lidas, 0);
  const percent = totalCaixas > 0 ? Math.round((totalLidas / totalCaixas) * 100) : 0;
  const isFinished = currentNf.status === 'conferida' || currentNf.status === 'em_entrega';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={onBack} className="btn btn-secondary">
          ← Voltar para Lista de NFs
        </button>
        <span className={`badge badge-${currentNf.status}`}>
          {currentNf.status.replace('_', ' ')}
        </span>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3>Conferência da Nota {currentNf.numero}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Cliente: <strong>{currentNf.cliente}</strong>
              <span> · Emp. {currentNf.codigo_empresa}</span>
              {currentNf.serie && <span> · Série {currentNf.serie}</span>}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Progresso Total</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: percent === 100 ? 'var(--success)' : 'var(--primary)' }}>
              {totalLidas} / {totalCaixas} caixas ({percent}%)
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '10px',
          background: '#1f293d',
          borderRadius: '999px',
          overflow: 'hidden',
          marginTop: '12px'
        }}>
          <div style={{
            height: '100%',
            width: `${percent}%`,
            background: percent === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Barcode Scanner Box */}
      {!isFinished && (
        <div className="card" style={{
          marginBottom: '24px',
          border: errorMsg ? '1px solid var(--danger)' : successMsg ? '1px solid var(--success)' : '1px solid var(--primary)',
          background: '#0d1322'
        }}>
          <h4 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ Leitor de Código de Barras (Caixa Master)</span>
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Aponte o leitor óptico USB ou digite o código de barras da caixa e pressione <strong>Enter</strong>.
          </p>

          <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '10px' }}>
            <input
              ref={inputRef}
              type="text"
              className={`input barcode-text ${errorMsg ? 'shake' : successMsg ? 'pulse-success' : ''}`}
              placeholder="Aguardando bip / código de barras..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              disabled={isScanning}
              autoFocus
              style={{ fontSize: '1.2rem', padding: '14px', letterSpacing: '0.1em' }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isScanning || !barcodeInput.trim()}
              style={{ minWidth: '120px' }}
            >
              {isScanning ? 'Lendo...' : 'Conferir'}
            </button>
          </form>

          {errorMsg && (
            <div style={{ marginTop: '10px', color: '#f87171', fontSize: '0.88rem', fontWeight: 600 }}>
              ❌ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ marginTop: '10px', color: '#4ade80', fontSize: '0.88rem', fontWeight: 600 }}>
              ✅ {successMsg}
            </div>
          )}
        </div>
      )}

      {/* Finished Banner & Assign Driver */}
      {currentNf.status === 'conferida' && (
        <div className="card" style={{
          marginBottom: '24px',
          border: '1px solid var(--success)',
          background: 'rgba(16, 185, 129, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <span style={{ fontSize: '2rem' }}>🎉</span>
            <div>
              <h3 style={{ color: 'var(--success)' }}>Nota Fiscal 100% Conferida!</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Todas as caixas foram conferidas com sucesso. Agora atribua um motorista para expedição.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="select"
              value={selectedMotorista}
              onChange={(e) => setSelectedMotorista(e.target.value)}
              style={{ maxWidth: '320px' }}
            >
              <option value="">Selecione o motorista responsável...</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  🚚 {m.nome} ({m.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleAssignMotorista}
              disabled={!selectedMotorista || isAssigning}
              className="btn btn-success"
            >
              {isAssigning ? 'Atribuindo...' : 'Expedir para Entrega'}
            </button>
          </div>
        </div>
      )}

      {/* Items Table / Cards */}
      <div style={{ marginBottom: '14px' }}>
        <h4>Itens da Nota Fiscal ({currentNf.itens.length})</h4>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {currentNf.itens.map((item) => {
          const itemPercent = item.caixas_necessarias > 0 ? (item.caixas_lidas / item.caixas_necessarias) * 100 : 0;
          return (
            <div
              key={item.id}
              className="card"
              style={{
                borderLeft: item.conferido ? '4px solid var(--success)' : '4px solid var(--warning)',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem' }}>
                      CÓD: {item.produto?.codigo || '—'} · REF: {item.produto?.referencia || '—'}
                    </span>
                    {item.produto?.localizacao && (
                      <LocationBadge location={item.produto.localizacao} />
                    )}
                  </div>
                  <h4 style={{ color: '#fff', marginTop: '4px' }}>
                    {item.produto?.descricao || 'Produto'}
                  </h4>
                  <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Cód. Caixa (DUN14): <span className="barcode-text" style={{ color: '#cbd5e1' }}>
                      {codigoCaixa(item.produto) || 'sem código de caixa'}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Nota: <strong>{item.qtd_nota} un</strong> ÷ <strong>{item.qtd_embalagem} un/cx</strong>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: item.conferido ? 'var(--success)' : '#fff' }}>
                    {item.caixas_lidas} / {item.caixas_necessarias} caixas
                  </div>
                  {item.conferido && (
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.8rem' }}>
                      ✓ CONFERIDO
                    </span>
                  )}
                </div>
              </div>

              {/* Individual progress bar */}
              <div style={{ height: '6px', background: '#1f293d', borderRadius: '4px', overflow: 'hidden', marginTop: '12px' }}>
                <div style={{
                  height: '100%',
                  width: `${itemPercent}%`,
                  background: item.conferido ? '#10b981' : '#f59e0b',
                  transition: 'width 0.3s'
                }} />
              </div>

              {/* Bipagem rapida de 1 caixa (simula a leitura do codigo da caixa) */}
              {!isFinished && !item.conferido && item.produto && (
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const codigo = codigoCaixa(item.produto);
                      if (codigo) handleQuickScan(codigo);
                    }}
                    disabled={!codigoCaixa(item.produto)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    title={
                      codigoCaixa(item.produto)
                        ? 'Simular leitura de 1 caixa deste produto'
                        : 'Produto sem código de caixa cadastrado (DUN14)'
                    }
                  >
                    Bipar Caixa (+1)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
