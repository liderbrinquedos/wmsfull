# Tech Debt - WMSFull

> **Ultima revisao:** 2026-10-22
> **Fonte:** inspecao completa do codigo (backend + frontend) na data de criacao da wiki.

| Prioridade | Significado |
|---|---|
| P0 | Bloqueia producao (segredo, perda de dado, falha em operacao real) |
| P1 | Riscos relevante de operacao ou seguranca |
| P2 | Qualidade de codigo / manutencao |
| P3 | Melhoria de UX ou performance |

---

## P0 - Bloqueiam Producao

### P0-01 Segredos com default hardcoded no codigo e no compose
- `backend/app/core/config.py:5-6` - `DATABASE_URL` e `SECRET_KEY` com valores fixos.
- `docker-compose.yml:35-37` - `SECRET_KEY: supersecretkey123changeme` versionado no repo.
- **Impacto:** qualquer pessoa com acesso ao repo forja tokens JWT de admin.
- **Correcao:** `SECRET_KEY` obrigatorio sem default, injetado por env var (Coolify).
  `DATABASE_URL` via `${DATABASE_URL:?}` no compose.

### P0-02 Credenciais de teste fixas na tela de login
- `frontend/src/auth/LoginPage.tsx:137,145,153,161` - 4 botoes de "login rapido" com
  `admin@log.com/admin123` etc., compilados no bundle de producao.
- **Impacto:** acesso trivial ao perfil admin em qualquer instalacao.
- **Correcao:** remover ou condicionar a `import.meta.env.DEV`.

### P0-03 Compose publica portas host (quebra no Coolify)
- `docker-compose.yml:17,43,55` - `ports: 5435/8005/3005`.
- **Impacto:** deploy no Coolify falha com `port is already allocated` (Traefik e outros apps).
- **Correcao:** `expose` no compose base + `docker-compose.override.yml` com `ports` para dev local.

### P0-04 Sem validacao do upload de foto do canhoto
- `backend/app/routers/delivery.py:47-56` - grava o arquivo byte a byte, sem whitelist de
  extensao, sem checagem de content-type/magic bytes, sem limite de tamanho.
- `await foto.read()` le o arquivo inteiro em memoria.
- **Impacto:** upload de arquivo arbitrario servido como estatico em `/uploads/`; risco de
  exaustao de memoria.
- **Correcao:** validar content-type + extensao, limitar tamanho, gravar em streaming.

### P0-05 `client_max_body_size` do Nginx = 1 MB (default)
- `frontend/nginx/nginx.conf` - nao configurado.
- **Impacto:** foto de canhoto tirada no celular e rejeitada com HTTP 413.
- **Correcao:** `client_max_body_size 10m;` (ou 5m) no bloco `server`.

---

## P1 - Riscos de Operacao e Seguranca

### P1-01 CORS liberado para todas as origens
- `backend/app/main.py:17-23` - `allow_origins=["*"]` com `allow_credentials=True`.
- **Correcao:** `allow_origins` a partir de env var `CORS_ORIGINS`.

### P1-02 Schema do banco sem migracoes
- `backend/alembic/` vazio, sem `alembic.ini`/`env.py`; `alembic` nao esta em `requirements.txt`.
- `Base.metadata.create_all` roda apenas em `app/seed.py:38` e **nunca** faz `ALTER TABLE`.
- **Impacto:** qualquer mudanca de coluna exige recriar o volume `pgdata` (perda de dados).
- **Correcao:** adopting Alembic - ver `ADR-003`.

### P1-03 `create_all` fora do ciclo da API
- `backend/app/main.py` nao importa `Base` nem os models.
- **Impacto:** rodar `uvicorn app.main:app` sem o seed beforehand quebra em runtime com
  `relation "users" does not exist`.
- **Correcao:** container de migracao/seed com `restart: "no"` (padrao Coolify).

### P1-04 Operador recebe 403 ao expedir NF para entrega
- `frontend/src/modules/conference/ConferenceSession.tsx:27` chama `adminApi.getMotoristas()`,
  que exige `admin|supervisor` (`backend/app/routers/admin.py:73`).
- `POST /conference/nf/{id}/assign` tambem exige `admin|supervisor`.
- **Impacto:** o operador ve o banner "Expedir para Entrega", mas a chamada falha com 403 e
  nao tem `.catch()` (unhandled promise rejection).
- **Correcao:** expor lista de motoristas em um endpoint de conferencia ou criar
  `GET /conference/motoristas` com `admin|supervisor|operador`.

### P1-05 Entrega sem restricao de perfil
- `backend/app/routers/delivery.py:32-68` e `:71-97` usam apenas `get_current_user`.
- **Impacto:** `admin`, `supervisor` e `operador` tambem podem executar baixa de entrega, e
  `Delivery.motorista_id` gravado e sempre o do usuario que executou, nao o da NF.
- **Correcao:** `require_roles("admin","supervisor","motorista")` + gravacao de
  `nf.motorista_id` quando o ator nao e o motorista.

### P1-06 PWA sem fila offline (campo sem sinal)
- `frontend/vite.config.ts` - Workbox `generateSW` apenas com `globPatterns`; sem
  `runtimeCaching` para `/api`, sem IndexedDB, sem `BackgroundSyncPlugin`.
- **Impacto:** bipagens e entregas se perdem emareas com cobertura instavel.
- **Correcao:** fila local de leituras + reenvio - ver `ADR-004`.

### P1-07 `PUT /admin/users/{id}` nao valida o perfil enviado
- `backend/app/routers/admin.py:47-67` aceita qualquer string em `perfil` (o `POST` valida).
- **Correcao:** reutilizar a mesma lista de perfis do `POST`.

### P1-08 Sem backup do PostgreSQL
- **Correcao:** `pg_dump` agendado + volume nomeado versionado.

### P1-09 `datetime.utcnow` depreciado no Python 3.12
- `backend/app/models/nota_fiscal.py:26`, `backend/app/models/delivery.py:26`,
  `backend/app/core/security.py:32`.
- **Correcao:** `datetime.now(timezone.utc)`.

---

## P2 - Qualidade e Manutencao

### P2-01 `app/crud/` vazio
- Queries SQLAlchemy inline nos routers (API `Query` legada, nao `select()` do SQLAlchemy 2.0).
- **Correcao:** extrair camada CRUD quando a duplicacao incomodar.

### P2-02 Pillow instalado e nao utilizado
- `backend/requirements.txt:10` declara `Pillow==10.3.0`; nenhum `.py` importa `PIL`.
- A foto do canhoto e gravada sem compressao nem thumbnail.
- **Correcao:** implementar redimensionamento (max 1920px, JPEG quality 80) como no
  `logdriver`.

### P2-03 `@tanstack/react-query` declarado e nao usado
- `frontend/package.json:16`; nao ha `QueryClientProvider`, `useQuery` nem `useMutation`.
- **Correcao:** remover a dependencia ou adotar a camada de cache.

### P2-04 Sem paginacao nas listagens
- Todos os endpoints de listagem retornam a colecao inteira.
- **Correcao:** `limit`/`offset` + total (padrao do `logconf`).

### P2-05 Manifesto PWA duplicado
- `frontend/public/manifest.json` e objeto inline em `frontend/vite.config.ts:11-23`,
  com conteudos divergentes.
- **Correcao:** manter apenas uma fonte de verdade.

### P2-06 Service worker servido com cache de 1 ano
- `frontend/nginx/nginx.conf:35-39` - a regra de estaticos casa `sw.js` e aplica
  `immutable`, impedindo a atualizacao do service worker.
- **Correcao:** excluir `sw.js` da regra de cache longo.

### P2-07 Headers de seguranca nao aplicados aos estaticos
- `add_header` dentro de `location` substitui (nao acumula com) os do nivel `server`.
- **Correcao:** repetir os headers no bloco de estaticos ou usar `always`.

### P2-08 `src/assets/icons/` vazio
- Diretorio criado e nunca usado (icones sao emoji ou SVG inline).

### P2-09 Sem testes
- Nenhum arquivo de teste no backend ou frontend.
- **Correcao:** pytest (regras de status e calculo de caixas) + Vitest (authStore).

### P2-10 Nomenclatura `logfull` herdada
- Containers, volume, banco e usuario do Postgres usam `logfull`, enquanto o projeto e
  `wmsfull`.
- **Correcao:** padronizar em `wmsfull` (impacto em volume existente e `DATABASE_URL`).

### P2-11 Imports nao utilizados
- `backend/app/schemas/schemas.py:1,4` (`EmailStr`, `math`),
  `backend/app/routers/conference.py:1` (`math`).

### P2-12 `JSON.parse` sem `try/catch` no store
- `frontend/src/store/authStore.ts:15` - `localStorage` corrompido quebra o bundle.

---

## P3 - UX e Performance

### P3-01 Nenhuma tratamento de erro de rede nas listagens
- `WMSPage`, `ConferencePage`, `DeliveryPage`, `AdminDashboard` usam apenas `console.error`;
  a UI fica vazia sem mensagem de falha.

### P3-02 Sem sistema de toast
- Feedback sempre inline (banners) ou `console.error`; modais duplicados por modulo.

### P3-03 Bug de timezone no default do reagendamento
- `frontend/src/modules/delivery/DeliveryModal.tsx:15-19` usa `toISOString().split('T')[0]`
  (UTC). Entre 00:00 e 03:00 (UTC-3) a data padrao e o dia corrente em vez de amanha.

### P3-04 `stats.estoque_baixo` devolvido e nunca consumido
- `backend/app/routers/wms.py:75` retorna a lista de ids; o frontend ignora.

### P3-05 Dependencias mortas na API client
- `wmsApi.getProduct` e `conferenceApi.getNF` nunca sao chamadas.

### P3-06 Ramo morto no `LocationBadge`
- `frontend/src/modules/wms/LocationBadge.tsx:13` - ternario interno inalcancavel.

### P3-07 Sem tela de "sem conexao" nem prompt de instalacao
- Nenhum tratamento de `beforeinstallprompt` ou `navigator.onLine`.

### P3-08 Fontes do Google Fonts sem cache offline
- `frontend/src/index.css:1` importa Inter e JetBrains Mono via CDN; nao entram no precache.

---

## Itens resolvidos
_(nenhum ainda - esta e a primeira revisiao)_
