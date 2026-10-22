# WMSFull

Sistema logistico integrated: **WMS (armazem)** + **Conferencia de carga** + **Entrega em campo**.
Consolida o enderecamento de estoque, a bipagem de notas fiscais por codigo de barras e a
baixa de entrega com foto do canhoto - em uma unica SPA mobile-first instalavel (PWA).

> Documentacao viva do projeto: `.wiki/` (ver `.wiki/INDEX.md`)
> Debito tecnico conhecido: `backlog/tech-debt.md`

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12, FastAPI 0.111, Uvicorn |
| ORM | SQLAlchemy 2.0 (API `Query`) |
| Banco | PostgreSQL 16 (volume `pgdata`) |
| Auth | JWT HS256 (python-jose) + bcrypt |
| Frontend | React 18, TypeScript 5, Vite 5, React Router 6 |
| Estado | Zustand 4 (auth) + localStorage |
| HTTP | Axios (instancia unica com interceptor de Bearer) |
| PWA | vite-plugin-pwa 0.20 + Workbox 7 (generateSW, autoUpdate) |
| Servidor | Nginx (static + proxy `/api` e `/uploads`) |
| Containers | Docker Compose (3 servicos) |

---

## Funcionalidades

### WMS - Armazem (`/wms`)
- Catalogo de produtos com busca por codigo, referencia ou descricao (debounce de 250 ms)
- KPIs: total de produtos, total de caixas, distribuicao por rua
- Enderecamento normalizado `RUA + PRAT + POS(2) + NIVEL` (ex.: `F102C`)
- Movimentacao de localizacao e ajuste de estoque em caixas master (admin/supervisor)

### Conferencia (`/conference`)
- Lista de notas fiscais com filtros por status (pendente, em_conferencia, conferida)
- Bipagem por codigo de barras master (leitor USB ou leitor de camera)
- Progresso por item (`caixas_lidas / caixas_necessarias`) e por nota
- Calculo automatico de caixas necessarias: `ceil(qtd_nota / qtd_embalagem)`
- Atribuicao de motorista e expedicao para entrega (admin/supervisor)

### Entrega (`/delivery`)
- Fila do motorista com KPIs clicaveis (a entregar, entregues, reagendadas)
- Baixa de entrega com foto do canhoto (captura pela camera do celular)
- Reagendamento com motivo (6 motivos pre-definidos) e nova data
- Historico de entregas com miniatura do canhoto (`/admin`)

### Gestao (`/admin`)
- Visao geral (total de NFs, por status, usuarios ativos, motoristas ativos)
- CRUD de usuarios com perfis e ativacao/desativacao (admin)
- Relatorio de entregas com filtro por motorista

---

## Quickstart

```bash
git clone git@github.com:liderbrinquedos/wmsfull.git
cd wmsfull
docker compose up -d
```

| Servico | URL |
|---|---|
| Web (SPA) | http://localhost:3005 |
| API | http://localhost:8005 |
| Docs OpenAPI | http://localhost:8005/docs |
| Postgres | `localhost:5435` |

### Credenciais de seed

Criadas automaticamente pelo `backend/app/seed.py` no primeiro boot:

| Perfil | Email | Senha |
|---|---|---|
| Admin | `admin@log.com` | `admin123` |
| Supervisor | `super@log.com` | `super123` |
| Operador | `operador@log.com` | `op123` |
| Motorista | `joao@log.com` | `moto123` |
| Motorista | `pedro@log.com` | `moto456` |

> O seed e idempotente: se ja houver usuarios, ele nao recria nada.

### Desenvolvimento local sem Docker

```bash
# Backend
cd backend
pip install -r requirements.txt
python app/seed.py
uvicorn app.main:app --reload --port 8005

# Frontend (proxy /api -> http://localhost:8005)
cd frontend
npm install
npm run dev
```

---

## Estrutura

```
wmsfull/
├── backend/
│   ├── app/
│   │   ├── core/           # config.py, database.py, security.py
│   │   ├── models/         # user, product, nota_fiscal, delivery
│   │   ├── schemas/        # schemas.py (13 schemas Pydantic)
│   │   ├── routers/        # auth, wms, conference, delivery, admin
│   │   ├── crud/           # (vazio - queries inline nos routers)
│   │   ├── main.py
│   │   └── seed.py
│   ├── alembic/            # (vazio - sem migracoes, ver ADR-003)
│   └── Dockerfile
├── frontend/
│   ├── nginx/nginx.conf    # proxy /api e /uploads
│   ├── public/             # manifest.json, icons/
│   └── src/
│       ├── api/client.ts   # axios + 5 namespaces de API
│       ├── auth/           # LoginPage, AuthGuard
│       ├── components/     # Layout, Navbar
│       ├── modules/        # wms, conference, delivery, admin
│       └── store/          # authStore
├── docker-compose.yml
├── .wiki/                  # base de conhecimento
├── backlog/                # debito tecnico
└── docs/                   # especificacoes de design
```

---

## Modelo de Dados

```
users ──┬── notas_fiscais ──┬── nf_itens ──── products
        │                   │
        │                   └── deliveries
        └── (motorista_id)
```

| Tabela | Papel |
|---|---|
| `users` | Usuarios com `perfil` (admin, supervisor, operador, motorista) e `ativo` |
| `products` | Catalogo com `qtd_embalagem`, `localizacao`, `estoque_caixas`, `codigo_barras_master` |
| `notas_fiscais` | Nota com maquina de status e `motorista_id` atribuido |
| `nf_itens` | Item da nota: `qtd_nota`, `caixas_necessarias`, `caixas_lidas`, `conferido` |
| `deliveries` | Baixa de entrega: status, `foto_canhoto_url`, `motivo_falha`, `data_reagendamento` |

Enums nativos do PostgreSQL: `perfil_enum`, `nf_status_enum`, `delivery_status_enum`.

---

## Maquina de Status da Nota

```
pendente ──start──> em_conferencia ──todos itens conferidos──> conferida
                                                                    │
                                                              assign (motorista)
                                                                    │
                                                                    v
                                                              em_entrega ──deliver──> entregue
                                                                    │
                                                            reschedule
                                                                    │
                                                                    v
                                                              reagendado
```

Referencia completa em `.wiki/integrations/api-catalog.md`.

---

## Observacoes Importantes

- As tabelas sao criadas por `python app/seed.py` (via `Base.metadata.create_all`),
  **nao** por Alembic - ver `ADR-003`.
- O PWA e instalavel e faz precache do shell estatico, mas **nao tem fila offline**
  - ver `ADR-004`.
- Nao existe importacao de dados: hoje o catalogo e as NFs vem apenas do seed.
  Ver `.wiki/integrations/data-sources.md`.
- O `docker-compose.yml` publica portas para dev local; em producao (Coolify) use
  `expose` + `docker-compose.override.yml` - ver `backlog/tech-debt.md`.
