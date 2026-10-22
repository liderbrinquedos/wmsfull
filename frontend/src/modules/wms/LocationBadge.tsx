import React from 'react';

interface LocationBadgeProps {
  location?: string | null;
}

// Formato padrao do endereco: RUA (1 letra) + PRATELEIRA (1 digito) +
// POSICAO (2 digitos) + NIVEL (1 letra). Ex.: F102C
const PADRAO = /^[A-Z]\d{3}[A-Z]$/;

export const LocationBadge: React.FC<LocationBadgeProps> = ({ location }) => {
  if (!location) {
    return (
      <span
        className="location-badge"
        title="Produto sem endereco cadastrado"
        style={{ color: 'var(--text-dim)', fontWeight: 600 }}
      >
        SEM LOCAL
      </span>
    );
  }

  // Endereco fora do padrao (ex.: MOSSORO, SACARIA, A041A/A042A) e texto livre:
  // nao tentar decodificar rua/prateleira, senao a tela mostra informacao falsa.
  if (!PADRAO.test(location)) {
    return (
      <span className="location-badge" title={location} style={{ maxWidth: '160px' }}>
        {location}
      </span>
    );
  }

  const rua = location[0];
  const prateleira = location[1];
  const posicao = location.slice(2, 4);
  const nivel = location[4];

  return (
    <div
      className="location-badge"
      title={`Rua ${rua} · Prateleira ${prateleira} · Posição ${posicao} · Nível ${nivel}`}
    >
      <span className="loc-rua">RUA {rua}</span>
      <span>P{prateleira}</span>
      <span>{posicao}</span>
      <span style={{ background: '#312e81', color: '#c7d2fe' }}>{nivel}</span>
    </div>
  );
};
