import React from 'react';

interface LocationBadgeProps {
  location: string; // ex: F102C
}

export const LocationBadge: React.FC<LocationBadgeProps> = ({ location }) => {
  // Parse format: [Rua 1 letra][Prat 1 digito][Pos 2 digitos][Nivel 1 letra]
  // Fallback if unusual format
  const rua = location.length >= 1 ? location[0] : '?';
  const prateleira = location.length >= 2 ? location[1] : '';
  const posicao = location.length >= 4 ? location.slice(2, 4) : '';
  const nivel = location.length >= 5 ? location[4] : (location.length === 5 ? location[4] : '');

  return (
    <div
      className="location-badge"
      title={`Rua ${rua} · Prateleira ${prateleira} · Posição ${posicao} · Nível ${nivel}`}
    >
      <span className="loc-rua">RUA {rua}</span>
      <span>P{prateleira}</span>
      {posicao && <span>{posicao}</span>}
      {nivel && <span style={{ background: '#312e81', color: '#c7d2fe' }}>{nivel}</span>}
    </div>
  );
};
