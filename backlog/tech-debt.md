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

Nenhum item em aberto. Os cinco foram resolvidos na fase 0 (ver **Itens resolvidos** no fim).

---

## P1 - Riscos de Operacao e Seguranca

### P1-01 CORS liberado para todas as origens
- `backend/app/main.py:17-23` - `allow_origins=["*"]` com `allow_credentials=True`.
- **Correcao:** `allow_origins` a partir de env var `CORS_ORIGINS`.
- **Status:** resolvido junto com a fase 0 (ver **Itens resolvidos**).

### P1-02 Schema do banco sem migracoes
- `backend/alembic/` vazio, sem `alembic.ini`/`env.py`; `alembic` nao esta em `requirements.txt`.
- `Base.metadata.create_all` roda apenas em `app/seed.py:38` e **nunca** faz `ALTER TABLE`.
- **Impacto:** qualquer mudanca de coluna exige recriar o volume `pgdata` (perda de dados).
- **Correcao:** adotar Alembic - ver [[decisions/006-alembic-e-migracoes]].
- **Planejado:** fase 1 do roadmap.

### P1-03 `create_all` fora do ciclo da API
- `backend/app/main.py` nao importa `Base` nem os models.
- **Impacto:** rodar `uvicorn app.main:app` sem o seed beforehand quebra em runtime com
  `relation "users" does not exist`.
- **Correcao:** container `migrate` one-shot (`alembic upgrade head`) com `restart: "no"`,
  do qual a `api` depende - ver [[decisions/006-alembic-e-migracoes]].
- **Planejado:** fase 1 do roadmap.

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

### P1-10 `notas_fiscais.numero` nao e chave natural
- `backend/app/models/nota_fiscal.py:19` - `numero` unico isoladamente.
- **Impacto:** dois fornecedores podem emitir a NF 1234 no mesmo dia; o segundo lote do
  sync do ERP seria rejeitado pela constraint.
- **Correcao:** `chave_nfe` (44) unica + indice composto
  `(cnpj_fornecedor, serie, numero)` - ver spec, secao 6.2.

### P1-11 Cobertura de EAN14 (caixa master) em 24,6%
- 491 de 1.997 SKUs tem DUN14 nas fichas tecnicas; faltam 1.508.
- **Impacto:** a bipagem da caixa nao tem codigo para tres de cada quatro produtos. O
  operador depende do botao "+1 Caixa".
- **Correcao:** coletar fichas dos demais fornecedores + CRUD de EAN no admin (fase 4).

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

### P2-13 Decoder de localizacao quebra com endereco fora do padrao
- `frontend/src/modules/wms/LocationBadge.tsx:8-11` - assume sempre 5 caracteres.
- 49 SKUs da planilha de referencia usam texto livre (`MOSSORO`, `SACARIA`,
  `BOLAS CHEIAS`) e 2 usam endereco duplo (`A041A/A042A`).
- **Impacto:** tooltip com "Rua M - Prateleira O - Posicao SS - Nivel O".
- **Correcao:** validar o padrao `RUA + 3 digitos + NIVEL` e, fora dele, renderizar texto
  simples sem decodificar.

### P2-14 Mensagem de carregamento cita um ERP que nao existe
- `frontend/src/modules/wms/WMSPage.tsx` - "Carregando produtos do ERP...".
- **Impacto:** informacao falsa para o operador enquanto o sync nao existir.
- **Correcao:** trocar por "Carregando produtos"; reavaliar quando a fase 3 entrar.

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

### P0-01 Segredos com default hardcoded no codigo e no compose
- **Resolvido em:** 2026-10-22 (fase 0).
- `config.py` exige `DATABASE_URL` e `SECRET_KEY` (min. 32 caracteres) sem default.
- `docker-compose.yml` usa `${VAR:?mensagem}`: sem a variavel, o compose nao sobe.
- `SECRET_KEY` saiu do compose versionado; `.env.example` explica como gerar.

### P0-02 Credenciais de teste fixas na tela de login
- **Resolvido em:** 2026-10-22 (fase 0).
- Bloco "Acesso Rapido para Testes" e a funcao `quickLogin` removidos de `LoginPage.tsx`.
- As contas do seed continuam existindo, mas so quando `SEED_DEMO_DATA=true`.

### P0-03 Compose publica portas host (quebra no Coolify)
- **Resolvido em:** 2026-10-22 (fase 0).
- Compose base so com `expose` e sem `container_name`.
- `docker-compose.override.yml` devolve `5435/8005/3005` para o ambiente local.

### P0-04 Sem validacao do upload de foto do canhoto
- **Resolvido em:** 2026-10-22 (fase 0).
- `backend/app/core/uploads.py`: whitelist de tipo (JPEG/PNG/WebP), extensao derivada do
  tipo (nao do nome enviado), assinatura binaria conferida, limite de 5 MB.
- Pendente de melhoria: o arquivo ainda e lido inteiro em memoria (limitado a 5 MB).

### P0-05 `client_max_body_size` do Nginx = 1 MB (default)
- **Resolvido em:** 2026-10-22 (fase 0).
- `client_max_body_size 10m` no bloco `server` de `frontend/nginx/nginx.conf`.

### P1-01 CORS liberado para todas as origens
- **Resolvido em:** 2026-10-22 (fase 0).
- `CORS_ORIGINS` (env, separado por virgula). Vazio = apenas a mesma origem, que e o caso
  do deploy (nginx serve o SPA e faz proxy de `/api`).
