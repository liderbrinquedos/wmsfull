# Current Focus: wmsfull

> **Atualizado em:** 2026-10-22

---

## Foco Atual

**Implementar o plano de producao aprovado** em
`docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`.

| # | Frente | Estado |
|---|---|---|
| 1 | Documentacao (`.wiki/`, `AGENTS.md`, `README.md`) | Concluido |
| 2 | Repositorio GitHub | Concluido |
| 3 | Brainstorm de producao + fontes de dados | Concluido (spec + ADR-006 + ADR-007) |
| 4 | Fase 0 - seguranca | Concluido (2026-10-22) |
| 5 | Fase 1 - Alembic e schema | Concluido (2026-10-22) |
| 6 | Fase 2 - homologacao no Coolify | **Proximo** (depende de acesso ao servidor) |
| 7 | Fase 3 - ingestao ERP (`/sync/*` + agente) | Concluido (2026-10-22) |
| 8 | Fase 4 - importacao de planilhas | Concluido (2026-10-22) |
| 9 | Fase 5 - go-live | Pendente (depende da fase 2) |

---

## Decisoes Fechadas

| Decisao | Registro |
|---|---|
| App publico no Coolify (celular pessoal com 4G) | spec, secao 3 (D1) |
| Ingestao por agente push, sem porta aberta | [[decisions/007-ingestao-por-agente-push]] |
| Batch 3x/dia (06h, 12h, 18h) + sincronizacao manual | spec, secao 3 (D3) |
| ERP manda produto/NF; WMSFull manda localizacao e estoque | spec, secao 3 (D4) |
| Localizacao **nao** vem do ERP; vem da planilha de referencia | spec, secao 3 (D4, D5) |
| Bipagem so por EAN14 (caixa) e codigo master legado | spec, secao 3 (D6) |
| Alembic agora, com uma migracao inicial | [[decisions/006-alembic-e-migracoes]] |
| Cobertura de DUN14 e pendencia de cadastro (1.508 SKUs) | spec, secao 3 (D7) |

---

## Fase 0 - Seguranca (concluida em 2026-10-22)

Itens de `backlog/tech-debt.md` que bloqueavam o deploy:

- [x] P0-01 `SECRET_KEY` e `DATABASE_URL` obrigatorios, sem default
- [x] P0-02 remover credenciais de teste da tela de login
- [x] P0-03 compose com `expose` + `docker-compose.override.yml`
- [x] P0-04 validar upload de foto do canhoto (`app/core/uploads.py`)
- [x] P0-05 `client_max_body_size` no nginx

Extra: P1-01 (CORS por env var) e `SEED_DEMO_DATA` (seed nao roda mais em producao).

---

## Fase 1 - Alembic e schema (concluida em 2026-10-22)

- [x] Alembic configurado (`alembic.ini`, `env.py`, revisao inicial `37849d286475`)
- [x] Colunas novas em `products` (ean13, ean14, origens, atualizado_em)
- [x] Colunas novas em `notas_fiscais` (chave_nfe, serie, cnpj, data_emissao, atualizado_em)
- [x] Tabelas de controle (`sync_runs`, `sync_run_errors`, `sync_requests`)
- [x] `seed.py` sem `create_all`; container `logfull-migrate` one-shot
- [x] Bipagem so por ean14/codigo master legado (ean13 recusado com mensagem)
- [x] Frontend tolera `localizacao` nula e endereco fora do padrao

Pendencia conhecida: `P1-11` (1.508 SKUs sem DUN14) so fecha na fase 4.

---

## Fase 3 - Ingestao ERP (concluida em 2026-10-22)

- [x] `POST /sync/runs`, `/sync/produtos`, `/sync/nf`, `/sync/requests/pending`,
      `/sync/runs/{id}/finish` com `X-Sync-Key`
- [x] Regras de posse: ERP escreve identidade/ean13/qtd; nunca localizacao, estoque ou ean14
- [x] NF fora de `pendente` ignorada; erro por item em `sync_run_errors`
- [x] Painel `/admin` > Sincronizacao (ultima execucao, erros, botao "Sincronizar agora")
- [x] Agente `sync-agent/` com fontes Postgres e CSV, agenda + polling de pedido

## Fase 4 - Planilhas (concluida em 2026-10-22)

- [x] Parser das fichas (`REF.`, variacoes de cabecalho) e da planilha de localizacao
- [x] `POST /import/preview` (nao grava) e `POST /import/apply`
- [x] Divergencias de `CX MASTER` so reportadas; ERP prevalece
- [x] CRUD manual de EAN (`PUT /wms/products/{id}/ean`) com DV validado
- [x] Tela de importacao no painel do admin

Falta para o go-live: deploy no Coolify (fase 2) e carga real + agente apontando para o ERP
(fase 5).

---

## Pendencias de Dados (nao de codigo)

- [ ] Fichas tecnicas das demais marcas/linhas (1.508 SKUs sem DUN14)
- [ ] Correcao na origem de 15 codigos com DV invalido e 2 com tamanho errado
- [ ] Definir quem corrige as 24 divergencias de `CX MASTER` no ERP
- [ ] Endereco dos 1.381 SKUs sem localizacao
- [ ] Host do banco do ERP + usuario read-only + views
- [ ] Destino do backup secundario
