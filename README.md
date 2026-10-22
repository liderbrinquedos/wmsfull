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
cp .env.example .env
```

Preencha no `.env`, antes de subir:

- `POSTGRES_PASSWORD` e `DATABASE_URL` — a mesma senha nos dois;
- `SECRET_KEY` — gere com `openssl rand -hex 32`.

```bash
docker compose up -d --build
```

As portas abaixo vem do `docker-compose.override.yml`, que so vale no ambiente local
(o Coolify usa o `docker-compose.yml` puro, sem portas publicadas):

| Servico | URL |
|---|---|
| Web (SPA) | http://localhost:3005 |
| API | http://localhost:8005 |
| Docs OpenAPI | http://localhost:8005/docs |
| Postgres | `localhost:5435` |

`SECRET_KEY`, `DATABASE_URL` e `POSTGRES_PASSWORD` nao tem valor padrao: sem eles o
compose se recusa a subir. E proposital — falhar no boot e melhor que rodar em producao
com chave publica.

### Credenciais de seed

O `seed.py` so cria os usuarios abaixo quando `SEED_DEMO_DATA=true` (o override local ja
liga; o compose base desliga):

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
export SECRET_KEY=$(openssl rand -hex 32)
export DATABASE_URL=postgresql://logfull:troque-esta-senha@localhost:5435/logfull
export SEED_DEMO_DATA=true
python app/seed.py
uvicorn app.main:app --reload --port 8005

# Frontend (proxy /api -> http://localhost:8005)
cd frontend
npm install
npm run dev
```

---

## Migracoes de schema

O schema e versionado com Alembic (ADR-006). No dia a dia:

```bash
# aplicar migracoes (o container logfull-migrate faz isso no boot)
docker compose run --rm logfull-migrate alembic upgrade head

# criar uma migracao depois de alterar os models
docker compose run --rm -v "$PWD/backend:/app" logfull-migrate \
  alembic revision --autogenerate -m "descricao curta"

# saber em que versao o banco esta
docker compose run --rm logfull-migrate alembic current
```

O `-v "$PWD/backend:/app"` faz o arquivo gerado aparecer no host: o container e
descartavel e nao persiste nada. Revise o arquivo antes de commitar — o `autogenerate`
nao detecta renomeacao de coluna e nao sabe que um `DROP` apaga dado.

Nunca use `docker compose down -v` em ambiente com dado real: e o unico comando que
apaga o volume do Postgres.

---

## Estrutura

```
wmsfull/
├── backend/
│   ├── app/
│   │   ├── core/           # config.py, database.py, security.py
│   │   ├── models/         # user, product, nota_fiscal, delivery, sync
│   │   ├── schemas/        # schemas.py (13 schemas Pydantic)
│   │   ├── routers/        # auth, wms, conference, delivery, admin
│   │   ├── crud/           # (vazio - queries inline nos routers)
│   │   ├── main.py
│   │   └── seed.py         # apenas dados, sob SEED_DEMO_DATA
│   ├── alembic/            # migracoes versionadas (ADR-006)
│   │   ├── env.py
│   │   └── versions/
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

- O schema e criado e versionado pelo **Alembic**: o container `logfull-migrate` roda
  `alembic upgrade head` e encerra; a API so sobe depois dele. Ver ADR-006.
- O `seed.py` **nao** cria tabelas: apenas insere dados de demonstracao, e somente com
  `SEED_DEMO_DATA=true`.
- O PWA e instalavel e faz precache do shell estatico, mas **nao tem fila offline**
  - ver `ADR-004`.
- Nao existe ingestao de dados ainda: hoje o catalogo e as NFs vem apenas do seed.
  O plano (agente push + importacao de planilhas) esta em
  `docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`.
- O `docker-compose.yml` publica portas para dev local; em producao (Coolify) use
  `expose` + `docker-compose.override.yml` - ver `backlog/tech-debt.md`.
