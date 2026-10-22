# System Overview - WMSFull

> **Ultima revisao:** 2026-10-22

## Arquitetura

```
┌───────────────────────────────────────────────────────────────┐
│                      Docker Compose                           │
│                                                                │
│  ┌──────────────────────┐     ┌─────────────────────────────┐  │
│  │  Nginx  (:80)        │     │   FastAPI  (:8000)          │  │
│  │  logfull-web         │     │   logfull-api               │  │
│  │                      │     │                             │  │
│  │  React SPA (PWA)     │────▶│  /auth  /wms  /conference  │  │
│  │  static files        │/api │  /delivery  /admin         │  │
│  │                      │     │                             │  │
│  │  try_files -> index  │     │  /uploads  (StaticFiles)   │  │
│  │  cache 1y nos assets │◀────│  uploads/ (volume)         │  │
│  │                      │     │                             │  │
│  └──────────────────────┘     └──────────────┬──────────────┘  │
│                                                │                │
│                                    ┌───────────▼────────────┐   │
│                                    │  PostgreSQL 16 (:5432) │   │
│                                    │  logfull-db            │   │
│                                    │  volume: pgdata        │   │
│                                    └────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

| Servico | Container | Porta host | Porta interna | Volume |
|---|---|---|---|---|
| Banco | `logfull-db` | 5435 | 5432 | `pgdata` |
| API | `logfull-api` | 8005 | 8000 | `uploads` |
| Web | `logfull-web` | 3005 | 80 | - |

> Em producao (Coolify) as portas host sao trocadas por `expose` - ver
> `backlog/tech-debt.md` (P0-03).

---

## Componentes

### Frontend (React 18 SPA + PWA)
- **Framework:** React 18.3 com TypeScript 5.2
- **Build:** Vite 5.3 (`npm run build` = `tsc && vite build`)
- **Roteamento:** React Router 6 (5 rotas + guarda por perfil)
- **Estado:** Zustand 4 com persistencia manual em `localStorage` (`authStore` unico)
- **HTTP:** Axios (instancia unica, `baseURL: '/api'`, interceptor de Bearer + 401)
- **PWA:** vite-plugin-pwa 0.20 (Workbox `generateSW`, `autoUpdate`, precache do shell)
- **Estilo:** CSS puro com design tokens em `:root` (tema dark, unico breakpoint em 768px)
- **Servido por:** Nginx (static files + proxy `/api` e `/uploads`)
- **Fonte de dados:** `src/api/client.ts` com 5 namespaces (`authApi`, `wmsApi`,
  `conferenceApi`, `deliveryApi`, `adminApi`), 20 funcoes

### Backend (FastAPI)
- **Framework:** FastAPI 0.111 + Uvicorn (standard)
- **Runtime:** Python 3.12 (imagem `python:3.12-slim`)
- **Banco:** PostgreSQL 16 via SQLAlchemy 2.0 (API `Query` legada, nao `select()`)
- **Auth:** JWT HS256 (python-jose) + bcrypt (passlib[bcrypt]); `oauth2_scheme` com
  `tokenUrl="/auth/login"`
- **Upload:** `python-multipart`; arquivos gravados como `{uuid4}{ext}` em `UPLOAD_DIR`
- **Imagens:** Pillow declarado, **nao usado** (backlog P2-02)
- **Docs:** OpenAPI automatico em `/docs` e `/redoc`
- **CORS:** `allow_origins=["*"]`, `allow_credentials=True` (backlog P1-01)

### Banco de Dados (PostgreSQL 16)

```
users ──┬── notas_fiscais ──┬── nf_itens ──── products
        │                   │
        │                   └── deliveries
        └── (motorista_id)
```

| Tabela | Colunas principais | Observacoes |
|---|---|---|
| `users` | id, nome, email, senha_hash, perfil, ativo | `email` unique; `perfil` ENUM |
| `products` | id, codigo, referencia, descricao, qtd_embalagem, localizacao, estoque_caixas, codigo_barras_master | `codigo` e `codigo_barras_master` unique |
| `notas_fiscais` | id, numero, fornecedor, destinatario, endereco, status, motorista_id, created_at | `numero` unique; `status` ENUM; FK -> users |
| `nf_itens` | id, nf_id, product_id, qtd_nota, qtd_embalagem, caixas_necessarias, caixas_lidas, conferido | FK -> notas_fiscais, products |
| `deliveries` | id, nf_id, motorista_id, status, foto_canhoto_url, motivo_falha, data_reagendamento, created_at | `status` ENUM; FK -> notas_fiscais, users |

**Enums nativos do PostgreSQL**
| Enum | Valores |
|---|---|
| `perfil_enum` | `admin`, `supervisor`, `operador`, `motorista` |
| `nf_status_enum` | `pendente`, `em_conferencia`, `conferida`, `em_entrega`, `entregue`, `reagendado` |
| `delivery_status_enum` | `entregue`, `reagendado` |

**Chaves primarias:** todas `String` com `default=str(uuid4())` - exceto o seed, que usa
IDs fixos (`u1`-`u5`, `p1`-`p5`, `nf1`-`nf3`, `i1`-`i6`).

---

## Endpoints (21)

| Prefixo | Endpoints | Perfis |
|---|---|---|
| `/auth` | `POST /login`, `GET /me` | publico / autenticado |
| `/wms` | `GET /products`, `GET /products/{id}`, `PUT /products/{id}/location`, `GET /stats` | autenticado / `admin,supervisor` na edicao |
| `/conference` | `GET /nf`, `GET /nf/{id}`, `POST /nf/{id}/start`, `POST /nf/{id}/scan`, `POST /nf/{id}/assign` | autenticado / `admin,supervisor,operador` / `admin,supervisor` |
| `/delivery` | `GET /nf`, `POST /nf/{id}/deliver`, `POST /nf/{id}/reschedule` | autenticado (motorista: proprias NFs) |
| `/admin` | `GET/POST /users`, `PUT /users/{id}`, `GET /motoristas`, `GET /reports/deliveries`, `GET /overview` | `admin` / `admin,supervisor` |
| app | `GET /`, `GET /health` | publico |

Detalhe completo em `[[integrations/api-catalog]]`.

---

## Seguranca

- **Autenticacao:** JWT HS256, payload `{sub, perfil}`, validade 480 min.
- **Senhas:** bcrypt (truncadas em 72 bytes).
- **Guarda no backend:** `get_current_user` (rejeita usuario inativo) e
  `require_roles(*roles)` (403 com a lista de perfis necessarios).
- **Guarda no frontend:** `AuthGuard` com `allowedRoles` por rota; redireciona para a rota
  padrao do perfil quando o acesso e negado.
- **Interceptors:** request injeta `Authorization: Bearer`; response com 401 limpa o
  `localStorage` e recarrega em `/login`.
- **Uploads:** gravados como `{uuid4}{ext}` e servidos como estaticos em `/uploads`
  (sem validacao de tipo/tamanho - backlog P0-04).
- **Pendencias criticas:** `SECRET_KEY` com default no codigo e no compose (P0-01),
  credenciais de teste no bundle (P0-02), CORS liberado (P1-01).

---

## Containerizacao

| Service | Build | Ports (dev) | Volumes | CMD |
|---|---|---|---|---|
| `logfull-db` | `postgres:16-alpine` | 5435:5432 | `pgdata:/var/lib/postgresql/data` | (postgres) |
| `logfull-api` | `./backend` | 8005:8000 | `uploads:/app/uploads` | `python app/seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| `logfull-web` | `./frontend` | 3005:80 | - | `nginx -g "daemon off;"` |

**Healthcheck:** apenas no Postgres (`pg_isready -U logfull`, 10s/5s/5 retries). A API e o
web nao tem healthcheck proprio (recomendado para o Coolify).

**Ordem de boot:** `logfull-api` depende de `logfull-db` com
`condition: service_healthy`; internamente o `seed.py` tambem faz `wait_for_db()`
(10 tentativas x 3 s).

---

## Dependencias

**Backend** (`backend/requirements.txt`): fastapi 0.111.0, uvicorn[standard] 0.30.0,
sqlalchemy 2.0.30, psycopg2-binary 2.9.9, python-jose[cryptography] 3.3.0,
passlib[bcrypt] 1.7.4, python-multipart 0.0.9, pydantic 2.7.1, pydantic-settings 2.2.1,
Pillow 10.3.0, python-dateutil 2.9.0.

**Frontend** (`frontend/package.json`): react 18.3, react-dom, react-router-dom 6.23,
zustand 4.5, @tanstack/react-query 5.40 (nao usado), axios 1.7 / dev: vite 5.3,
typescript 5.2, vite-plugin-pwa 0.20, workbox-window 7.1.
