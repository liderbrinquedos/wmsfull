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
| 5 | Fase 1 - Alembic e schema | **Proximo** |
| 6 | Fase 2 - homologacao no Coolify | Pendente |
| 7 | Fase 3 - ingestao ERP (`/sync/*` + agente) | Pendente |
| 8 | Fase 4 - importacao de planilhas | Pendente |
| 9 | Fase 5 - go-live | Pendente |

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

## Pendencias de Dados (nao de codigo)

- [ ] Fichas tecnicas dos demais fornecedores (1.508 SKUs sem DUN14)
- [ ] Correcao na origem de 15 codigos com DV invalido e 2 com tamanho errado
- [ ] Definir quem corrige as 24 divergencias de `CX MASTER` no ERP
- [ ] Endereco dos 1.381 SKUs sem localizacao
- [ ] Host do banco do ERP + usuario read-only + views
- [ ] Destino do backup secundario
