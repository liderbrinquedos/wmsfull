import React, { useState, useEffect } from 'react';
import { Product, wmsApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { ProductCard } from './ProductCard';
import { MoveLocationModal } from './MoveLocationModal';

export const WMSPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { user } = useAuthStore();
  const canEdit = ['admin', 'supervisor'].includes(user?.perfil || '');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, s] = await Promise.all([
        wmsApi.getProducts(search),
        wmsApi.getStats()
      ]);
      setProducts(prods);
      setStats(s);
    } catch (err) {
      console.error('Erro ao carregar dados do WMS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleProductUpdated = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    wmsApi.getStats().then(setStats);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2>📦 Módulo 1 — Armazém (WMS)</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Gestão de produtos do ERP, quantidades por embalagem master e endereçamento físico
        </p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px'
        }}>
          <div className="card" style={{ padding: '14px 18px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total de SKUs
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
              {stats.total_produtos}
            </div>
          </div>

          <div className="card" style={{ padding: '14px 18px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Caixas em Estoque
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
              {stats.total_caixas} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>cx</span>
            </div>
          </div>

          <div className="card" style={{ padding: '14px 18px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Ruas Ocupadas
            </span>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
              {Object.entries(stats.por_rua || {}).map(([rua, qtd]: any) => (
                <span
                  key={rua}
                  style={{
                    background: '#1e293b',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#38bdf8'
                  }}
                >
                  Rua {rua}: {qtd}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          className="input"
          placeholder="🔍 Buscar por código (ex: 21), referência (ex: 49) ou nome do produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '600px' }}
        />
      </div>

      {/* Product List Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Carregando produtos do ERP...
        </div>
      ) : products.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Nenhum produto encontrado para a busca "{search}".
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              canEdit={canEdit}
              onEdit={setEditingProduct}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <MoveLocationModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={handleProductUpdated}
        />
      )}
    </div>
  );
};
