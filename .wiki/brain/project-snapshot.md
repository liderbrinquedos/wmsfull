# Project Snapshot: wmsfull

**Stack:** Python 3.12 (FastAPI 0.111 + SQLAlchemy 2.0 + PostgreSQL 16) + React 18 (Vite 5 + TypeScript 5 + Zustand + PWA)
**Objetivo:** Sistema logistico unico que cobre o ciclo completo - enderecamento de estoque (WMS), bipagem de notas fiscais (Conferencia) e baixa de entrega com foto do canhoto (Entrega).

> **Ultima revisao:** 2026-10-22

---

## Status Atual

- Codigo funcional completo (backend + frontend + docker-compose).
- Documentacao da wiki criada nesta revisao (`.wiki/`).
- Repositorio: `git@github.com:liderbrinquedos/wmsfull.git` (branch `main`).
- **Nao** ha deploy em producao ainda - deploy e fontes de dados estao em aberto
  (ver `[[current-focus]]`).
- **Nao** ha testes, **nao** ha importacao de dados, **nao** ha migracoes de schema.

---

## Estrutura do Projeto

```
wmsfull/
├── backend/                        # API FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # App, CORS, mount /uploads, routers
│   │   ├── seed.py                 # create_all + dados de exemplo (idempotente)
│   │   ├── core/
│   │   │   ├── config.py           # Settings (pydantic-settings), 5 variaveis
│   │   │   ├── database.py         # engine, SessionLocal, Base, get_db
│   │   │   └── security.py         # bcrypt, JWT, get_current_user, require_roles
│   │   ├── models/
│   │   │   ├── user.py             # User (perfil_enum)
│   │   │   ├── product.py          # Product
│   │   │   ├── nota_fiscal.py      # NotaFiscal (nf_status_enum) + NFItem
│   │   │   └── delivery.py         # Delivery (delivery_status_enum)
│   │   ├── schemas/schemas.py      # 13 schemas Pydantic v2
│   │   ├── routers/
│   │   │   ├── auth.py             # /auth
│   │   │   ├── wms.py              # /wms
│   │   │   ├── conference.py       # /conference
│   │   │   ├── delivery.py         # /delivery
│   │   │   └── admin.py            # /admin
│   │   └── crud/                   # VAZIO - queries inline nos routers
│   ├── alembic/                    # VAZIO - sem migracoes (ADR-003)
│   ├── requirements.txt            # 11 dependencias fixadas
│   └── Dockerfile                  # python:3.12-slim, CMD seed + uvicorn
├── frontend/                       # SPA React
│   ├── index.html                  # pt-BR, manifest, theme-color #0f172a
│   ├── vite.config.ts              # react + VitePWA, proxy /api e /uploads
│   ├── nginx/nginx.conf            # proxy /api e /uploads, SPA fallback, gzip
│   ├── public/                     # manifest.json, icons/icon.svg
│   ├── Dockerfile                  # node:20-alpine -> nginx:alpine
│   └── src/
│       ├── main.tsx                # StrictMode, sem QueryClientProvider
│       ├── App.tsx                 # rotas + AuthGuard
│       ├── index.css               # 281 linhas, design tokens dark
│       ├── api/client.ts           # axios + 5 namespaces (20 funcoes)
│       ├── auth/                   # LoginPage.tsx, AuthGuard.tsx
│       ├── components/             # Layout.tsx, Navbar.tsx
│       ├── modules/
│       │   ├── wms/                # WMSPage, ProductCard, LocationBadge, MoveLocationModal
│       │   ├── conference/         # ConferencePage, ConferenceSession
│       │   ├── delivery/           # DeliveryPage, DeliveryModal
│       │   └── admin/              # AdminDashboard
│       ├── store/authStore.ts      # Zustand + localStorage (token, user)
│       └── assets/icons/           # VAZIO
├── docker-compose.yml              # db 5435, api 8005, web 3005
├── .wiki/                          # base de conhecimento
├── backlog/tech-debt.md            # 28 itens priorizados
└── docs/                           # especificacoes de design
```

---

## Modelo de Dados

```
users ──┬── notas_fiscais ──┬── nf_itens ──── products
        │                   │
        │                   └── deliveries
        └── (motorista_id)
```

| Tabela | Colunas principais |
|---|---|
| `users` | id, nome, email (unique), senha_hash, perfil (enum), ativo |
| `products` | id, codigo (unique), referencia, descricao, qtd_embalagem, localizacao, estoque_caixas, codigo_barras_master (unique) |
| `notas_fiscais` | id, numero (unique), fornecedor, destinatario, endereco, status (enum), motorista_id, created_at |
| `nf_itens` | id, nf_id, product_id, qtd_nota, qtd_embalagem, caixas_necessarias, caixas_lidas, conferido |
| `deliveries` | id, nf_id, motorista_id, status (enum), foto_canhoto_url, motivo_falha, data_reagendamento, created_at |

Todos os `id` sao `String` com `default=str(uuid4())`.

Enums nativos do PostgreSQL: `perfil_enum`, `nf_status_enum`, `delivery_status_enum`.

---

## Rotas do Frontend

| Rota | Tela | Perfis | Home por perfil |
|---|---|---|---|
| `/login` | LoginPage | publico | - |
| `/wms` | WMSPage | admin, supervisor, operador | admin/supervisor |
| `/conference` | ConferencePage | admin, supervisor, operador | operador |
| `/delivery` | DeliveryPage | admin, supervisor, motorista | motorista |
| `/admin` | AdminDashboard | admin, supervisor | - |

---

## Perfis

| Perfil | WMS | Conferencia | Entrega | Admin |
|---|---|---|---|---|
| `admin` | leitura + edicao | total | total | total |
| `supervisor` | leitura + edicao | total | total | leitura |
| `operador` | leitura | total | leitura | - |
| `motorista` | leitura | - | proprias NFs | - |

---

## Convencoes

- **Idioma:** portugues
- **Markdown da wiki:** sem acentos, links `[[nome-do-arquivo]]`
- **Commits:** Conventional Commits em portugues
- **Datas:** `datetime.utcnow` no backend (UTC), formatacao `pt-BR` no frontend
- **API:** `baseURL: '/api'`; nginx remove o prefixo via `proxy_pass http://logfull-api:8000/`
- **Uploads:** `uuid4` + extensao original em `/app/uploads`, servidos em `/uploads/<uuid><ext>`
- **Auth:** JWT HS256, `Authorization: Bearer <token>`, validade 480 min
- **Persistencia da sessao:** `localStorage` chaves `token` e `user`
- **Nomes de container/banco:** `logfull-*` (heranca; ver backlog P2-10)
