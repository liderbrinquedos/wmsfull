# Documento de Design — Producao e Fontes de Dados (WMSFull)

**Data:** 2026-10-22 · **Status:** aprovado; fases 0, 1, 3 e 4 implementadas

---

## 1. Objetivo

Colocar o WMSFull em producao publica e definir de onde vem cada dado que ele exibe,
resolvendo duas restricoes que hoje bloqueiam o go-live:

1. **O ERP e inalcancavel pela internet.** Os dados de produto, de nota fiscal e de
   codigo de barras so existem no banco do ERP, dentro da rede da empresa.
2. **A operacao de campo exige app publico.** O motorista usa celular pessoal com 4G,
   sem VPN e sem rede controlada pela empresa. O app precisa de dominio e HTTPS.

Resultado esperado: catalogo real carregado, notas fiscais chegando do ERP em batch,
bipagem funcionando pelo codigo da caixa, e deploy reproduzivel no Coolify.

---

## 2. Estado atual (fatos medidos)

### 2.1 Codigo

- 21 endpoints em 5 routers; schema criado por `Base.metadata.create_all` no
  `backend/app/seed.py` (sem Alembic — ADR-003).
- Nenhuma entrada de dados alem do seed: nao existe importacao, integracao com ERP,
  nem endpoint de cadastro de produto ou de NF.
- `products` tem **um unico** codigo de barras (`codigo_barras_master`), sem distincao
  entre unidade e caixa.
- `notas_fiscais.numero` e unico isoladamente, sem chave de acesso da NF-e.

### 2.2 Fontes de dados declaradas

| Dado | Origem | Formato | Observacao |
|---|---|---|---|
| codigo, referencia, descricao, **EAN13** (unidade), qtd. embalagem | ERP | banco, dentro da rede | leitura read-only |
| Notas fiscais + itens | ERP | banco, dentro da rede | inclui qtd. e embalagem |
| **EAN14 / DUN14** (caixa master) | Planilhas `FICHA TECNICA *.xlsx` | xlsx | cobertura parcial |
| Quantidade de embalagens | Planilha `Localizacao.xlsx` | xlsx | conflita com o ERP |
| **Localizacao** | Planilha `Localizacao.xlsx` | xlsx | decisao: **nao vem do ERP** |
| Estoque em caixas | WMSFull | tela WMS | manual, como hoje |
| Usuarios | WMSFull | tela admin | como hoje |
| Entregas e canhotos | WMSFull | app | como hoje |

### 2.3 Planilha `Localizacao.xlsx` (medida)

| Metrica | Valor |
|---|---|
| SKUs | 1.998 |
| Codigos duplicados | 0 |
| Referencias unicas | 1.997 |
| SKUs sem localizacao | 1.381 (69%) |
| Localizacoes distintas | 460 |
| `RUA + 3 digitos + NIVEL` (ex.: `A016A`) | 568 linhas |
| Texto livre (`MOSSORO`, `SACARIA`, `BOLAS CHEIAS`) | 49 linhas |
| Endereco duplo (`A041A/A042A`) | 2 linhas |
| `Quantidade de embalagens` vazia | 60 linhas |

### 2.4 Planilhas `FICHA TECNICA *.xlsx` (medidas)

Cabecalho real na **linha 2**; chave de juncao com o catalogo e **`REF.`** (nao o codigo).
Colunas usadas: `REF.`, `DESCRICAO`, `LINHA`, `CX MASTER`, `EAN 13`, `DUN 14`.
Variacoes de cabecalho ja tratadas: `DUN14` (APOLO), `DUN INT` (LIDER, preenchido em 2 de
224 linhas), `DESCRICAO` ausente (FANDOMBOX).

| Ficha | SKUs | EAN13 | DUN14 | REFs encontradas no catalogo |
|---|---|---|---|---|
| APOLO | 112 | 112 | 112 | 112 / 112 |
| FANDOMBOX | 155 | 155 | 155 | 155 / 155 |
| LIDER | 224 | 224 | 224 | 224 / 224 |
| **Total** | **491** | **491** | **491** | **100%** |

Qualidade dos dados de origem:

| Anomalia | Ocorrencias |
|---|---|
| EAN13 com digito verificador invalido | 2 (LIDER) |
| DUN14 com digito verificador invalido | 12 |
| DUN14 com tamanho errado (15 e 13 digitos) | 2 (LIDER) |
| `CX MASTER` divergente da planilha de localizacao | 24 (APOLO 11, LIDER 13) |
| EAN13 ou DUN14 duplicado | 0 |

Cobertura: **491 de 1.997 SKUs (24,6%)**. Faltam **1.508 SKUs sem codigo de caixa**.

O DUN14 **nao e derivavel**: o digito indicador varia de 1 a 9 (379 com `1`, 37 com `2`,
30 com `3`, 19 com `5`, 11 com `4`, 6 com `6`, 5 com `7`, 1 com `8`, 1 com `9`). Dos 489
pares validos, 474 seguem `indicador + EAN13 sem DV + DV recalculado`, mas os 15 restantes
nao seguem — gerar por regra produziria codigo errado em 3% dos casos.

---

## 3. Decisoes

### D1 — App publico no Coolify

Celular pessoal com 4G, sem VPN. Dominio proprio + TLS via Traefik/Let's Encrypt do
Coolify. Mesmo padrao ja usado em `logdriver` e `secontrola`.

### D2 — Ingestao por agente push (ADR-007)

O dado sai de dentro para fora: um container `wmsfull-sync` roda no servidor interno (que
tem acesso ao ERP **e** internet), le o ERP em read-only e faz `POST` autenticado na API
publica. O app publico **nunca** inicia conexao para a rede interna.

Descartados:

| Alternativa | Motivo da rejeicao |
|---|---|
| App no Coolify consultando API/banco interno | exige expor a rede interna (tunel/VPN) e acopla toda tela do app a um link fora do nosso controle |
| Export + import manual de arquivo | e o fallback, nao o caminho principal; erro humano e esquecimento |

### D3 — Cadencia: 3x/dia + manual

Agenda fixa (06h, 12h, 18h, configuravel) e fallback sob demanda: o botao "Sincronizar
agora" grava um pedido no banco; o agente consulta `GET /sync/requests/pending` a cada
2 minutos e atende. Sem porta aberta, sem IP fixo, sem VPN.

### D4 — Posse dos dados

| Campo | Dono | Regra |
|---|---|---|
| `codigo`, `referencia`, `descricao`, `ean13`, `qtd_embalagem` | ERP | sync sobrescreve quando traz valor |
| `localizacao` | WMSFull | sync **nunca** toca |
| `estoque_caixas` | WMSFull | sync **nunca** toca |
| `ean14` | ficha / admin | sync **nunca** toca |
| NF `pendente` | ERP | sync atualiza cabecalho e itens |
| NF `em_conferencia` ou alem | WMSFull | sync **ignora** (nao regride status nem zera `caixas_lidas`) |

`qtd_embalagem`: **ERP prevalece**. `CX MASTER` das fichas e `Quantidade de embalagens` da
planilha de localizacao servem apenas para conferencia e geram divergencia no relatorio.

### D5 — Localizacao fora do padrao entra como texto

`MOSSORO`, `SACARIA`, `BOLAS CHEIAS`, `A041A/A042A` sao aceitos como texto livre. Rejeitar
49 linhas validas do negocio seria pior que aceitar endereco fora do formato.

### D6 — Bipagem estrita

`POST /conference/nf/{id}/scan` resolve apenas `ean14` e, como legado,
`codigo_barras_master`. `ean13` **nao** e aceito nessa rota: aceitar unidade onde se
espera caixa multiplica a contagem por `qtd_embalagem` sem aviso. Quando o produto nao
tiver codigo de caixa, a resposta e explicita e o operador usa o botao "+1 Caixa" que ja
existe na tela de conferencia.

### D7 — Cobertura de DUN14 como pendencia de cadastro

Importar os 491 disponiveis agora; CRUD manual de EAN no admin; seguir coletando fichas
das demais marcas. A lacuna de 1.508 SKUs e aceita no go-live, com saida manual.

### D8 — Alembic agora (ADR-006)

Com tres fontes de dados e sete colunas novas, `create_all` deixa de ser viavel. Introduzir
Alembic enquanto nao existe dado de producao: uma migracao inicial com o schema final,
`seed.py` apenas inserindo dados (condicionado a `SEED_DEMO_DATA`), e container one-shot
`migrate` antes da API.

---

## 4. Arquitetura

```
REDE INTERNA (atras do firewall)
+------------------------------------------------------------------+
|                                                                  |
|   ERP (banco)  <-- SELECT read-only (usuario e views dedicadas)   |
|      ^                                                           |
|      |                                                           |
|   +--+--------------------------------+                          |
|   |  wmsfull-sync  (container)        |                          |
|   |   loop de 2 min                   |                          |
|   |   agenda 06h / 12h / 18h          |                          |
|   |   watermark do ultimo sucesso     |                          |
|   +--+--------------------------------+                          |
+------+-----------------------------------------------------------+
       |  saida 443, header X-Sync-Key
       v
--- INTERNET ------------------------------------------------------
       |
+------v-----------------------------------------------------------+
| COOLIFY (publico, dominio + TLS)                                 |
|                                                                  |
|   wmsfull-web (nginx)  --proxy-->  wmsfull-api (FastAPI)         |
|      - SPA/PWA instalavel              - /api/*  (JWT)           |
|      - /uploads/*                      - /sync/*  (X-Sync-Key)   |
|                                        - /uploads/*              |
|                                              |                   |
|                                        postgres (interno)        |
+------------------------------------------------------------------+
       ^
       |  4G / HTTPS
   Celular do operador e do motorista (PWA instalado)
```

Canais de entrada, e apenas estes:

| Canal | Quem inicia | O que entra |
|---|---|---|
| `POST /sync/*` | agente (rede interna -> internet) | produtos e NFs do ERP |
| `POST /import/*` | admin pela UI | fichas (EAN13/DUN14) e planilha de localizacao |
| `POST /admin/sync/request` | admin pela UI | pedido de sincronizacao manual |

O pedido manual ficou em `/admin/sync/request` (nao em `/sync/requests`): quem cria e o
admin autenticado por JWT; quem consulta e o agente por `X-Sync-Key`, em
`GET /sync/requests/pending`.

Fluxo de uma execucao agendada:

```
06:00  agente acorda
       -> conexao read-only no ERP (SELECT em views)
       -> monta lotes de ate 500 produtos
       -> POST https://<dominio>/sync/produtos      (X-Sync-Key)
       -> wmsfull-api valida a chave e faz upsert
       -> resposta {gravados, erros[]}
       -> POST /sync/runs/{id}/finish               (contagens e erros)
       -> dorme ate 12:00
```

---

## 5. Contratos

### 5.1 Agente -> API

Autenticacao separada do login de usuario: header `X-Sync-Key` (chave longa aleatoria em
env var), comparacao em tempo constante. Nao expostos no frontend.

| Endpoint | Corpo | Regra |
|---|---|---|
| `POST /sync/runs` | `tipo`, `origem` | abre a execucao e devolve o id |
| `POST /sync/produtos` | lote de ate 500 produtos | upsert por `codigo` |
| `POST /sync/nf` | lote de NFs com itens | upsert por `chave_nfe`, com fallback `(serie, numero)` |
| `GET /sync/requests/pending` | - | devolve o pedido mais antigo ou 204 |
| `POST /sync/runs/{id}/finish` | contagens, status, erros, `request_id` | fecha a execucao e atende o pedido |

Implementado com `SYNC_API_KEY` vazia = 503 (endpoint desabilitado), o que evita subir sem
a chave e achar que o sync esta funcionando.

Erro **por item**, nao por lote: item invalido vira linha em `sync_run_errors` e o resto do
lote entra.

### 5.2 Planilhas -> API

Upload `multipart/form-data` pela UI do admin, em duas etapas obrigatorias:

1. `POST /import/preview` — valida e devolve relatorio sem gravar (linhas lidas, validas,
   rejeitadas, divergencias, REFs nao encontradas, codigos com DV invalido).
2. `POST /import/apply` — aplica somente o que passou e grava o relatorio em `sync_runs`
   (`tipo = 'ficha' | 'localizacao'`).

Mapeamento:

| Arquivo | Juncao | Escreve |
|---|---|---|
| `FICHA TECNICA *.xlsx` | `REF.` <-> `products.referencia` | `ean13`, `ean14` |
| `Localizacao.xlsx` | `Codigo` <-> `products.codigo` | `localizacao` |

O `tipo` vai como campo do formulario (`ficha` | `localizacao`). O `apply` reprocessa o
arquivo enviado — nao ha estado entre as duas chamadas. Se o arquivo mudar entre preview e
apply, o relatorio aplicado e o do arquivo novo; por isso o run guarda o nome do arquivo.

Regras confirmadas na implementacao (medidas com as planilhas reais de 2026-10):

| Situacao | Resultado |
|---|---|
| linha sem alteracao | conta em `sem_alteracao`, nao aparece como erro |
| `CX MASTER` diferente de `qtd_embalagem` | vai para `divergencias`; **nunca** altera |
| EAN13 divergente de um valor vindo do ERP | ERP preservado, motivo registrado |
| EAN14 com `origem = manual` | preservado, motivo registrado |
| DUN14 com DV invalido | linha rejeitada, com numero da linha na planilha |
| `REF.` inexistente no catalogo | conta em `nao_encontradas` |
| localizacao vazia na planilha | conta em `sem_localizacao`, nao apaga o endereco atual |

### 5.3 Painel do admin

`GET /admin/sync/status` devolve: ultima execucao por tipo, quando, contagens, erros e
pedido manual pendente. Sem isso, "o sync rodou" e fe.

O pedido manual e criado por `POST /admin/sync/request` (idempotente: se ja existe um
pendente, devolve o mesmo) e consumido pelo agente.

---

## 6. Modelo de dados

### 6.1 `products`

| Campo | Mudanca | Regra |
|---|---|---|
| `ean13` | novo `String(13)`, unique, nullable | unidade; ERP prevalece |
| `ean14` | novo `String(14)`, unique, nullable | caixa master; ficha/admin |
| `ean13_origem`, `ean14_origem` | novo `String(8)` | `erp` \| `ficha` \| `manual` |
| `qtd_embalagem` | passa a `NOT NULL default 1` | 60 linhas vazias viram 1 |
| `localizacao` | nullable explicito | 1.381 SKUs entram como `NULL` |
| `codigo_barras_master` | mantido | legado, aceito na bipagem, obsoleto na doc |
| `atualizado_em` | novo `timestamp` | `onupdate=now` |

`ean13_origem`/`ean14_origem` existem para que uma correcao manual nao seja sobrescrita em
silencio e para que o relatorio de import saiba o que pode alterar.

### 6.2 `notas_fiscais`

A nota e de **saida**: a empresa emite e o cliente recebe. O emitente e sempre a propria
empresa, entao o numero e sequencial **por serie** — `numero` sozinho nao identifica a
nota, e a chave de acesso (`chave_nfe`) e a identificacao definitiva.

| Campo | Mudanca |
|---|---|
| `chave_nfe` | novo `String(44)`, unique, nullable |
| `serie` | novo `String(10)`, nullable |
| `cliente` | novo `String`, NOT NULL (veio de `destinatario`) |
| `cnpj_cliente` | novo `String(14)`, nullable |
| `data_emissao` | novo `Date`, nullable |
| `atualizado_em` | novo `timestamp` |
| `fornecedor` | **removido** — nao existe contraparte de compra neste fluxo |
| `destinatario` | **renomeado** para `cliente` |
| `numero` | **perde o `unique` global**; continua indexado |

Constraint unica `(serie, numero)`; Postgres permite multiplos `NULL`, entao as NFs antigas
(sem serie) continuam validas. `chave_nfe` unica por cima de tudo.

Correcao registrada na revisao `9f2c41b7a6d3`: a primeira versao do schema tratava a nota
como compra de fornecedor (`fornecedor` + `destinatario` + unicidade por
`cnpj_fornecedor`). O fluxo real e de expedicao para cliente. Se um dia houver mais de uma
filial emitindo, entra `cnpj_emitente` e a constraint vira
`(cnpj_emitente, serie, numero)`.

### 6.3 Tabelas de controle

```
sync_runs        (id, tipo, origem, status, iniciado_em, finalizado_em,
                  lidos, gravados, erros, mensagem, solicitado_por)
sync_run_errors  (id, run_id, entidade, chave, campo, motivo)
sync_requests    (id, solicitado_por, solicitado_em, atendido_em, run_id, status)
```

`tipo` em `erp` | `ficha` | `localizacao` — um par de tabelas atende os tres caminhos.

### 6.4 Migracoes (ADR-006) - implementado

1. `alembic init` + `env.py` lendo `DATABASE_URL` do Settings.
2. Uma migracao inicial por `autogenerate` ja com o schema final.
3. `seed.py` deixa de chamar `create_all`; apenas insere dados quando
   `SEED_DEMO_DATA=true`.
4. Container one-shot `migrate` roda `alembic upgrade head` e sai com 0; `api` depende com
   `condition: service_completed_successfully`.

Revisao da migracao gerada: `downgrade()` tambem remove os tipos ENUM do Postgres
(`perfil_enum`, `nf_status_enum`, `delivery_status_enum`), senao um novo `upgrade head`
falha com `type ... already exists`. O ciclo completo `downgrade base` -> `upgrade head`
foi executado e verificado.

---

## 7. Deploy / Coolify

| Item | Decisao |
|---|---|
| Aplicacao | uma app Docker Compose no Coolify, branch `main` |
| Compose base | `expose` apenas, sem `ports` e sem `container_name` |
| Local | `docker-compose.override.yml` devolve `5435/8005/3005`, fora do Coolify |
| Dominio | um FQDN no servico `web`; API e banco sem dominio publico |
| TLS | Let's Encrypt pelo Traefik do Coolify |
| Env obrigatorias | `SECRET_KEY`, `DATABASE_URL`, `SYNC_API_KEY`, `CORS_ORIGINS` |
| Env de operacao | `SEED_DEMO_DATA=false`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `TZ=America/Sao_Paulo` |
| Ordem de boot | `db` healthy -> `migrate` completa -> `api` -> `web` |
| Nginx | `client_max_body_size 10m`, `sw.js` com `no-store`, headers no bloco de estaticos |
| Backup | `pg_dump` diario (retencao 7/4/12) + volume `uploads`; destino secundario a definir |
| Healthcheck | API em `/health`, web em `/` |

Nenhuma env com valor padrao no codigo: `SECRET_KEY` sem default quebra o boot de proposito.

---

## 8. Roadmap de implementacao (fases)

| Fase | Conteudo | Tamanho |
|---|---|---|
| 0. Seguranca | P0-01 a P0-05: segredos, credenciais do login, upload validado, `client_max_body_size`, compose | P | **concluida** |
| 1. Schema | ADR-006, Alembic, colunas novas, seed data-only, container `migrate` | M | **concluida** |
| 2. Homologacao | deploy Coolify com seed de demonstracao; valida dominio, TLS e ordem de boot | P |
| 3. Ingestao ERP | `/sync/*`, agente no servidor interno, `sync_runs`, painel e botao no admin | G | **concluida** |
| 4. Planilhas | `/import/preview` + `/apply`, fichas e localizacoes, CRUD de EAN no admin | M | **concluida** |
| 5. Go-live | `SEED_DEMO_DATA=false`, carga real (491 + localizacoes), primeiro sync, backup ligado | P |
| 6. Pos-go-live | fila offline, compressao de foto, paginacao, testes | G |

A fase 2 antecede a 3 de proposito: problema de compose/Coolify se descobre com dado de
mentira, nao com sync real.

---

## 9. Riscos e mitigacao

| Risco | Impacto | Mitigacao |
|---|---|---|
| Driver do banco do ERP desconhecido (Postgres/MySQL/SQL Server) | atrasa a fase 3 | fase 1 e 4 nao dependem disso; confirmar antes de comecar o agente |
| 1.508 SKUs sem DUN14 | bipagem manual nesses itens | botao "+1 Caixa", CRUD de EAN, coleta de fichas |
| 15 codigos das fichas com DV invalido | import rejeita a linha | relatorio aponta linha e motivo; correcao na origem |
| `numero` de NF repetido em series diferentes | sync sobrescreve NF errada | `chave_nfe` como chave; fallback `(serie, numero)` |
| Sync noturno reescrevendo NF em conferencia | perda de bipagem | regra de D4: sync ignora NF fora de `pendente` |
| Agente parado sem ninguem notar | catalogo e NFs velhos | `sync_runs` + painel; alerta por ultima execucao |
| Perda de bipagem sem rede (ADR-004) | operacao perdida | fase 6 (fila offline); ate la a operacao exige conexao |
| Migracao em producao | perda de dados | fases 0-1 antes de existir dado real; backup diario |

---

## 10. Pendencias de dados (nao de codigo)

- Fichas tecnicas das demais marcas/linhas (1.508 SKUs sem codigo de caixa).
- Correcao na origem dos 15 codigos com DV invalido e dos 2 com tamanho errado.
- Definicao de quem corrige as 24 divergencias de `CX MASTER` no ERP.
- Endereco dos 1.381 SKUs sem localizacao.
- Nome/host do banco do ERP e criacao do usuario read-only com views.
- Definir destino do backup secundario.

---

## 11. Links

- [[decisions/006-alembic-e-migracoes]]
- [[decisions/007-ingestao-por-agente-push]]
- [[integrations/data-sources]]
- [[architecture/system-overview]]
- [[brain/business-rules]]
