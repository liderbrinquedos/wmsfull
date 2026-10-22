# Pattern: Frontend Standards - WMSFull

> **Categoria:** frontend-design
> **Complexidade:** media
> **Ultima revisao:** 2026-10-22

Padrao visual do WMSFull: tema **dark**, CSS puro com design tokens, grid mobile-first
com um unico breakpoint.

> Nota: a familia de projetos tem um padrao light "Clean Tech / Precision Minimalism"
> (`.wiki/patterns/frontend-standards.md` na raiz de `aplicacoes/`). O WMSFull usa uma
> variante **dark** com a mesma filosofia (alto contraste, foco claro, tipografia
> consistente), porque a operacao de campo acontece sob iluminacao variavel e em tela
> pequena.

---

## Quando Usar

Em qualquer tela ou componente novo do `frontend/src/`.

---

## Como Implementar

### Design tokens (unica fonte de verdade)

Todos os tokens vivem em `:root` em `frontend/src/index.css` e sao consumidos por
`var(--token)`. **Nunca** escrever cor hexada direto no JSX.

```css
:root {
  --bg-main: #090d16;
  --bg-card: #111827;
  --bg-card-hover: #1f2937;
  --bg-input: #1f293d;
  --border-color: #2e3a50;
  --border-focus: #38bdf8;

  --primary: #0ea5e9;
  --primary-hover: #0284c7;
  --primary-glow: rgba(14, 165, 233, 0.25);

  --success: #10b981;
  --success-bg: rgba(16, 185, 129, 0.15);
  --warning: #f59e0b;
  --warning-bg: rgba(245, 158, 11, 0.15);
  --danger: #ef4444;
  --danger-bg: rgba(239, 68, 68, 0.15);
  --info: #6366f1;
  --info-bg: rgba(99, 102, 241, 0.15);

  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.5);

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
}
```

**Paleta:** base slate escuro (`#090d16` - `#1f2937`), primario sky/cyan (`#0ea5e9`),
semanticas emerald / ambar / indigo / vermelho.

### Tipografia

| Uso | Fonte | Classe |
|---|---|---|
| Interface | Inter (`--font-sans`) | padrao |
| Codigo de barras, localizacao, SKU | JetBrains Mono (`--font-mono`) | `.barcode-text` |

`.barcode-text` = `font-family: var(--font-mono); letter-spacing: 0.08em;`

> As fontes vem do Google Fonts via `@import` em `index.css`. Isso e uma dependencia
> externa em runtime (backlog P3-08) - em producao, considere servir localmente.

### Classes utilitarias disponiveis

| Classe | Uso |
|---|---|
| `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-success` / `.btn-danger` | Botoes |
| `.form-group`, `.form-label`, `.input`, `.select`, `.textarea` | Formularios |
| `.card` | Card com borda e sombra |
| `.badge` + `.badge-<status>` | Etiqueta de status |
| `.location-badge` (+ `.loc-rua`) | Endereco de estoque |
| `.barcode-text` | Texto monoespacado |
| `.modal-overlay`, `.modal-content` | Modais |
| `.shake`, `.pulse-success` | Feedback de bipagem |
| `.desktop-only`, `.mobile-only` | Visibilidade por breakpoint |

**Badges de status** (cor por estado da NF):

| Classe | Status | Cor |
|---|---|---|
| `.badge-pendente` | pendente | warning |
| `.badge-em_conferencia` | em_conferencia | info |
| `.badge-conferida` | conferida | success |
| `.badge-em_entrega` | em_entrega | primary |
| `.badge-entregue` | entregue | success |
| `.badge-reagendado` | reagendado | danger |

### Responsivo

- **Um unico breakpoint: 768px.**
- `.desktop-only` -> `display: none` abaixo de 768px.
- `.mobile-only` -> `display: none` a partir de 769px.
- Navegacao: **topo** no desktop (`.desktop-only`), **barra fixa inferior** no mobile
  (`.mobile-only`, 60px, `z-index: 100`) - o padrao de app operacional.
- Grid de produtos: `repeat(auto-fill, minmax(320px, 1fr))`.
- Layout principal: `max-width: 1280px`, centralizado, `padding: 24px 20px 80px`.

### Estados de interacao obrigatorios

Toda acao precisa dos 4 estados:

| Estado | Implementacao |
|---|---|
| Carregando | flag `loading` + texto "Carregando..." (nao spinner - nao ha componente) |
| Vazio | mensagem explicativa (ex.: "Nenhum produto encontrado para a busca") |
| Erro | banner inline com `err.response?.data?.detail` |
| Sucesso | banner inline verde / animacao `.pulse-success` |

### Feedback de bipagem

```
[erro]    input com borda --danger + glow + animacao .shake
[sucesso] input com borda --success + glow + animacao .pulse-success
```

Ambos com `transition` curto (0.2s) - o operador precisa de confirmacao imediata da
bipagem.

### Icones

- **Emoji** como padrao (📦 🔍 🚚 ⚙️ 📍 ✓ ○ ▶ ⚡ 📷 ↻).
- SVG inline apenas para a logo do login e do navbar.
- `src/assets/icons/` esta vazio e nao deve ser usado como deposito de icones.

---

## Regras

1. Cor sempre via `var(--token)`, nunca hex direto.
2. Foco de input sempre visivel: borda `--border-focus` + anel `--primary-glow`.
3. Alvos de toque (botoes de acao em campo) com no minimo 44px de altura.
4. Fonte monoespacada para dado que o operador **confere caractere a caractere**
   (localizacao, codigo de barras).
5. Nenhuma informacao critica transmitida **apenas** por cor - sempre texto junto
   (ex.: estoque baixo mostra o numero, nao so a cor laranja).
6. Modais: `.modal-overlay` + `.modal-content`, fechar ao clicar fora e no `X`.

## Anti-Patterns (o que EVITAR)

- Criar um tema novo em vez de usar os tokens.
- Introduzir Tailwind/PostCSS/Sass no projeto (nao ha toolchain para isso).
- Adicionar um segundo breakpoint sem um ADR.
- Esconder acao sem texto (so icone) em acao destrutiva.
- Deixar o `loading` sem feedback visual durante chamada a API.

---

## Exemplo no Projeto

- `frontend/src/index.css` - tokens, classes utilitarias, animacoes
- `frontend/src/components/Navbar.tsx` - navegacao desktop/mobile + cor por perfil
- `frontend/src/modules/wms/ProductCard.tsx` - card com badge de estoque colorido
- `frontend/src/modules/wms/LocationBadge.tsx` - decodificacao do endereco com tooltip
- `frontend/src/modules/conference/ConferenceSession.tsx` - `.shake` / `.pulse-success`
- `frontend/src/modules/delivery/DeliveryModal.tsx` - modal de baixa com preview da foto

## Links Relacionados

- [[patterns/coding-standards]]
- [[brain/glossary]]
- [MDN - CSS custom properties](https://developer.mozilla.org/pt-BR/docs/Web/CSS/--*)
