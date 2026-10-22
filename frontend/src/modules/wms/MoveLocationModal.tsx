import React, { useState } from 'react';
import { Product, wmsApi } from '../../api/client';

interface MoveLocationModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: (updated: Product) => void;
}

export const MoveLocationModal: React.FC<MoveLocationModalProps> = ({ product, onClose, onSuccess }) => {
  const [rua, setRua] = useState(product.localizacao[0] || 'A');
  const [prateleira, setPrateleira] = useState(product.localizacao[1] || '1');
  const [posicao, setPosicao] = useState(product.localizacao.slice(2, 4) || '01');
  const [nivel, setNivel] = useState(product.localizacao[4] || 'A');
  const [estoqueCaixas, setEstoqueCaixas] = useState(product.estoque_caixas);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fullLocation = `${rua.toUpperCase()}${prateleira}${posicao.padStart(2, '0')}${nivel.toUpperCase()}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const updated = await wmsApi.updateLocation(product.id, fullLocation, estoqueCaixas);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao atualizar localização');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3>Movimentar Produto</h3>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ marginBottom: '16px', padding: '12px', background: '#1e293b', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{product.descricao}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Cód: <strong>{product.codigo}</strong> · Ref: <strong>{product.referencia}</strong>
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Localização atual: <span className="barcode-text" style={{ color: 'var(--primary)' }}>{product.localizacao}</span>
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: '#fca5a5', padding: '10px', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Rua (Letra)</label>
              <input
                type="text"
                maxLength={1}
                className="input"
                required
                value={rua}
                onChange={(e) => setRua(e.target.value.toUpperCase())}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prateleira (Nº)</label>
              <input
                type="number"
                min={1}
                max={9}
                className="input"
                required
                value={prateleira}
                onChange={(e) => setPrateleira(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Posição (2 dígitos)</label>
              <input
                type="text"
                maxLength={2}
                className="input"
                required
                value={posicao}
                onChange={(e) => setPosicao(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nível (Letra)</label>
              <input
                type="text"
                maxLength={1}
                className="input"
                required
                value={nivel}
                onChange={(e) => setNivel(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estoque em Caixas Master</label>
            <input
              type="number"
              min={0}
              className="input"
              required
              value={estoqueCaixas}
              onChange={(e) => setEstoqueCaixas(parseInt(e.target.value) || 0)}
            />
          </div>

          <div style={{
            background: 'rgba(14, 165, 233, 0.1)',
            border: '1px solid var(--primary)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nova Localização Resultante: </span>
            <strong style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
              {fullLocation}
            </strong>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar Localização'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
