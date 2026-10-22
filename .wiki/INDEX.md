# .wiki - LLM Knowledge Base

> **Projeto:** WMSFull - Sistema Logistico (WMS + Conferencia + Entrega)
> **Ultima atualizacao:** 2026-10-22
> **Proximo ADR:** ADR-008

Este diretorio e o segundo cerebro do projeto. Subagentes e opencode devem consultar este
indice antes de tomar decisoes.

---

## Mapa de Conhecimento

### Brain
- `[[brain/project-snapshot]]` - Stack, objetivo, estrutura e estado real do codigo
- `[[brain/current-focus]]` - Foco atual do trabalho
- `[[brain/business-rules]]` - Regras de negocio (armazem, conferencia, entrega)
- `[[brain/api-contracts]]` - Contratos das operacoes de negocio
- `[[brain/glossary]]` - Vocabulario do dominio
- `[[brain/learnings]]` - Erros, descobertas e aprendizados
- `[[brain/scratchpad]]` - rascunho livre

### Architecture
- `[[architecture/system-overview]]` - Containers, tabelas, enums, perfis
- `[[architecture/data-flow]]` - Fluxos: login, conferencia, expedicao, entrega

### Decisions (ADRs)
- [[decisions/001-arquitetura-fastapi-react-pwa]] - FastAPI + React + PWA + PostgreSQL
- [[decisions/002-rbac-por-perfil]] - Controle de acesso por perfil (RBAC)
- [[decisions/003-schema-criado-por-seed-sem-alembic]] - Schema criado pelo seed, sem Alembic
- [[decisions/004-pwa-instalavel-sem-fila-offline]] - PWA instalavel, sem fila offline
- [[decisions/005-consolidacao-de-wms-conferencia-entrega]] - Um unico app para as 3 operacoes
- [[decisions/006-alembic-e-migracoes]] - Alembic e migracoes versionadas (substitui a 003)
- [[decisions/007-ingestao-por-agente-push]] - Ingestao de dados por agente push (ERP -> API)

### Docs (especificacoes de design)
- `docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md` - Producao,
  topologia, contratos de sync/import, modelo de dados e fases
- `docs/deploy-coolify.md` - Playbook de deploy, backup/restore e checklist de go-live

### Patterns
- `[[patterns/coding-standards]]` - Padroes de codigo (Python, SQLAlchemy 2.0, TypeScript, React)
- `[[patterns/frontend-standards]]` - Design system (tokens dark, componentes, responsivo)
- `[[patterns/ripgrep-workflow]]` - Workflow de buscas com ripgrep
- `[[patterns/alembic-workflow]]` - Migracoes com Alembic (autogenerate, downgrade, revisao)

### Projects
- `[[projects/wmsfull]]` - Contexto completo do projeto

### Integrations
- `[[integrations/api-catalog]]` - Catalogo completo dos endpoints da API
- `[[integrations/data-sources]]` - Fontes de dados (matriz de posse por campo)
- `[[integrations/sync-agent]]` - Agente de ingestao no servidor interno

### Snippets
- `[[snippets/utils]]` - Padroes reutilizaveis de codigo

---

## Como Usar com opencode

1. **Antes de codar** -> leia este INDEX e `[[brain/project-snapshot]]`
2. **Ao tomar decisoes** -> consulte `decisions/`
3. **Para seguir padroes** -> consulte `patterns/` e `snippets/`
4. **Ao integrar servicos** -> consulte `integrations/api-catalog`
5. **Para buscar codigo** -> use ripgrep (`rg`) - ver `[[patterns/ripgrep-workflow]]`
6. **Ao achar um bug** -> registre em `[[brain/learnings]]` e avalie `backlog/tech-debt.md`

---

## Como Adicionar Entradas

1. Copie um template de `.wiki/templates/`
2. Preencha com as informacoes
3. Adicione um link neste INDEX
4. Referencie de outras paginas relacionadas com `[[links]]`

---

## Templates Disponiveis

- `[[templates/decision-template]]` - Para ADRs
- `[[templates/pattern-template]]` - Para padroes

---

## Comandos Rapidos

```bash
# Subir stack completa (migrate -> api -> web)
docker compose up -d

# Aplicar migracoes manualmente
docker compose run --rm logfull-migrate alembic upgrade head

# Acessar
http://localhost:3005     # SPA
http://localhost:8005/docs # OpenAPI

# Backend sem Docker (banco ja migrado)
cd backend && SEED_DEMO_DATA=true python app/seed.py && uvicorn app.main:app --reload --port 8005

# Frontend
cd frontend && npm run dev
```
