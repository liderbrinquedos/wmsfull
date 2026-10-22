import React, { useState } from 'react';
import { Product, wmsApi } from '../../api/client';

interface EanModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: (updated: Product) => void;
}

/**
 * Cadastro manual dos codigos de barras. Existe para os 1.508 SKUs sem ficha
 * tecnica: sem ean14 o produto nao pode ser bipado como caixa.
 */
export const EanModal: React.FC<EanModalProps> = ({ product, onClose, onSuccess }) => {
  const [ean13, setEan13] = useState(product.ean13 ?? '');
  const [ean14, setEan14] = useState(product.ean14 ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const updated = await wmsApi.updateEan(product.id, {
        ean13: ean13.trim(),
        ean14: ean14.trim(),
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar os códigos de barras');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3>Códigos de barras</h3>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ marginBottom: '16px', padding: '12px', background: '#1e293b', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{product.descricao}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Cód: <strong>{product.codigo}</strong> · Ref: <strong>{product.referencia}</strong>
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)',
            color: '#fca5a5',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '14px',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">EAN13 (unidade)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={13}
              className="input"
              placeholder="13 dígitos"
              value={ean13}
              onChange={(e) => setEan13(e.target.value.replace(/\D/g, ''))}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Usado para identificar o produto, não para bipar caixa.
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">EAN14 / DUN14 (caixa master)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={14}
              className="input"
              placeholder="14 dígitos"
              value={ean14}
              onChange={(e) => setEan14(e.target.value.replace(/\D/g, ''))}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              É este código que o operador bipa na conferência.
            </span>
          </div>

          <div style={{
            background: 'rgba(14, 165, 233, 0.08)',
            border: '1px solid var(--border-color)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '18px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            O dígito verificador é conferido ao salvar. Deixe vazio para remover o código.
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar códigos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
