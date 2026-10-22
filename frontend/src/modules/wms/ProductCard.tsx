import React from 'react';
import { Product } from '../../api/client';
import { LocationBadge } from './LocationBadge';

interface ProductCardProps {
  product: Product;
  canEdit: boolean;
  onEdit: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, canEdit, onEdit }) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              CÓD: {product.codigo} · REF: {product.referencia}
            </span>
            <h4 style={{ fontSize: '1.05rem', marginTop: '2px', color: '#fff' }}>
              {product.descricao}
            </h4>
          </div>
          <LocationBadge location={product.localizacao} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '10px',
          background: '#090d16',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          margin: '12px 0'
        }}>
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', display: 'block' }}>Qtd/Embalagem</span>
            <strong style={{ color: '#fff' }}>{product.qtd_embalagem} un/cx</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', display: 'block' }}>Estoque em Caixas</span>
            <strong style={{ color: product.estoque_caixas < 5 ? 'var(--warning)' : '#10b981' }}>
              {product.estoque_caixas} cx ({product.estoque_caixas * product.qtd_embalagem} un)
            </strong>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Cód. Barras Master: </span>
          <span className="barcode-text" style={{ color: '#e2e8f0' }}>{product.codigo_barras_master}</span>
        </div>
      </div>

      {canEdit && (
        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={() => onEdit(product)}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '0.82rem', padding: '6px 12px' }}
          >
            📍 Alterar Localização
          </button>
        </div>
      )}
    </div>
  );
};
