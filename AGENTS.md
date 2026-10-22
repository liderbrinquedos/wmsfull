# AGENTS.md - Sistema Operacional de Projeto WMSFull

> **Projeto:** WMSFull - Sistema Logistico (WMS + Conferencia + Entrega)
> **Ultima atualizacao:** 2026-10-22

---

## Missao

Maximarizar produtividade e minimizar consumo de tokens atraves do LeanKG e da Wiki
Incremental, mantendo o conhecimento permanente do projeto em `.wiki/`.

---

## Protocolo de Busca (Obrigatorio)

Antes de qualquer tarefa, siga a hierarquia de contexto:

1. **LeanKG** - mapear estrutura e dependencias:
   ```bash
   leankg query "termo"
   leankg impact <arquivo>
   ```
2. **Brain** - ler `.wiki/brain/project-snapshot.md` e `.wiki/brain/current-focus.md`
3. **Wiki** - consultar `.wiki/patterns/` e `.wiki/decisions/`
4. **Codigo** - buscar com `rg` (nunca `grep`/`find`)

---

## Regras de Escrita

| Evento | Onde registrar | Como |
|---|---|---|
| Decisao arquitetural | `.wiki/decisions/ADR-NNN-titulo.md` | Copie `.wiki/templates/decision-template.md` |
| Novo padrao de codigo | `.wiki/patterns/nome-do-padrao.md` | Copie `.wiki/templates/pattern-template.md` |
| Erro / aprendizado | `.wiki/brain/learnings.md` | Entrada datada |
| Glossario / novo termo | `.wiki/brain/glossary.md` | Termo + definicao |
| Mudanca de foco | `.wiki/brain/current-focus.md` | Atualizar data e foco |
| Debito tecnico | `backlog/tech-debt.md` | Prioridade P0-P3 |

Ao criar decisoes relevantes, **referencie no codigo** com:
```python
# ADR-002: motivo da restricao
```

---

## Estrutura do Projeto

```
wmsfull/
├── backend/            # API FastAPI (Python 3.12)
│   ├── app/
│   │   ├── core/       # config, database, security (JWT/bcrypt)
│   │   ├── models/     # User, Product, NotaFiscal, NFItem, Delivery
│   │   ├── schemas/    # Pydantic v2
│   │   ├── routers/    # auth, wms, conference, delivery, admin
│   │   ├── crud/       # VAZIO - queries inline nos routers
│   │   ├── main.py     # App FastAPI, CORS, mount /uploads
│   │   └── seed.py     # Popula dados de exemplo (SEED_DEMO_DATA)
│   ├── alembic/        # migracoes versionadas (ADR-006)
│   └── Dockerfile
├── frontend/           # SPA React 18 + Vite 5 + PWA
│   └── src/
│       ├── api/        # cliente axios unico + namespaces
│       ├── auth/       # LoginPage, AuthGuard
│       ├── components/ # Layout, Navbar
│       ├── modules/    # wms, conference, delivery, admin
│       └── store/      # authStore (Zustand + localStorage)
├── docker-compose.yml  # db (5435) + api (8005) + web (3005)
├── .wiki/              # Segundo cerebro do projeto
├── backlog/            # Debito tecnico priorizado
└── docs/               # Especificacoes de design
```

---

## Convencoes

- **Idioma:** portugues
- **Markdown:** sem emojis, links de wiki no formato `[[nome-do-arquivo]]` (sem `.md`)
- **ADRs:** numerados `001-titulo-curto.md`
- **Commits:** Conventional Commits em portugues (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Datas no backend:** `datetime.utcnow` (UTC); exibicao no frontend em `pt-BR`
- **Chamadas de API:** sempre via `src/api/client.ts` (baseURL `/api`), nunca axios direto
- **Imagens de upload:** `uuid4` + extensao original, servidas em `/uploads/`
- **Auth:** JWT HS256 via `Authorization: Bearer <token>`; token e usuario persistidos em
  `localStorage` nas chaves `token` e `user`

---

## Perfis de Acesso (RBAC)

| Perfil | WMS | Conferencia | Entrega | Admin |
|---|---|---|---|---|
| `admin` | total | total | total | total |
| `supervisor` | edicao | total | total | leitura |
| `operador` | leitura | total | leitura | - |
| `motorista` | leitura | - | proprias NFs | - |

---

## Como Usar com opencode

1. **Antes de codar** -> leia `.wiki/INDEX.md` e `.wiki/brain/project-snapshot.md`
2. **Ao tomar decisoes** -> consulte `.wiki/decisions/`
3. **Para seguir padroes** -> consulte `.wiki/patterns/` e `.wiki/snippets/`
4. **Ao integrar servicos** -> consulte `.wiki/integrations/api-catalog.md`
5. **Para buscar codigo** -> use `rg` (ver `.wiki/patterns/ripgrep-workflow.md`)
