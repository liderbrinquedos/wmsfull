# Projeto: WMSFull

> **Ultima revisao:** 2026-10-22

## Visao Geral

O WMSFull e um sistema logistico unico que cobre o ciclo completo da operacao de
armazem e de entrega: enderecamento de estoque (**WMS**), verificacao de carga por
codigo de barras (**Conferencia**) e baixa de entrega com foto do canhoto (**Entrega**).

Ele substitui tres aplicacoes isoladas da familia (`logstock`, `logconf`, `logdriver`),
eliminando a duplicacao de cadastros e criando o encadeamento que antes era manual: uma
nota conferida vira entrega na fila do mesmo motorista, no mesmo banco.

## Stack Tecnologica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18.3, TypeScript 5.2, Vite 5.3, React Router 6.23 |
| Estado / cache | Zustand 4.5 (auth) / TanStack Query 5.40 (declarado, nao usado) |
| HTTP | Axios 1.7 (instancia unica, `baseURL: '/api'`) |
| PWA | vite-plugin-pwa 0.20 + Workbox 7 (generateSW, autoUpdate) |
| Estilo | CSS puro com design tokens dark em `:root` |
| Backend | Python 3.12, FastAPI 0.111, Uvicorn 0.30 |
| ORM | SQLAlchemy 2.0 (API `Query`) |
| Banco | PostgreSQL 16 (volume `pgdata`) |
| Auth | JWT HS256 (python-jose) + bcrypt (passlib) |
| Uploads | python-multipart; arquivos `{uuid4}{ext}` em volume `uploads` |
| Servidor | Nginx (static + proxy `/api` e `/uploads`) |
| Container | Docker Compose: `logfull-db`, `logfull-api`, `logfull-web` |

## Modulos

| Modulo | Tela | Rotas | O que faz |
|---|---|---|---|
| WMS | `WMSPage` | `/wms` | Catalogo, busca, KPIs por rua, enderecamento e estoque |
| Conferencia | `ConferencePage` + `ConferenceSession` | `/conference` | Lista de NFs, bipagem por codigo de barras, expedicao |
| Entrega | `DeliveryPage` + `DeliveryModal` | `/delivery` | Fila do motorista, baixa com canhoto, reagendamento |
| Gestao | `AdminDashboard` | `/admin` | Visao geral, usuarios, historico de entregas |
| Auth | `LoginPage` | `/login` | Login por email/senha com login rapido de demonstracao |

## Papeis e Permissoes

| Perfil | WMS | Conferencia | Entrega | Admin |
|---|---|---|---|---|
| `admin` | leitura + edicao | total | total | total |
| `supervisor` | leitura + edicao | total | total | leitura |
| `operador` | leitura | total | leitura | - |
| `motorista` | leitura | - | proprias NFs | - |

Detalhe da matriz em `[[brain/business-rules]]`.

## Fluxo da Operacao

```
1. Catalogo no armazem      -> /wms        (produto, localizacao, estoque)
2. NF pendente na doca      -> /conference (bipagem: caixas_lidas / caixas_necessarias)
3. NF conferida             -> atribuicao de motorista (expedicao)
4. Entrega em campo         -> /delivery   (foto do canhoto ou reagendamento)
5. Supervisao               -> /admin      (visao geral, usuarios, historico)
```

## Status da Entrega / NF

`pendente` -> `em_conferencia` -> `conferida` -> `em_entrega` -> `entregue` | `reagendado`

## Estado Atual

- Aplicacao **funcional** ponta a ponta (backend + frontend + compose).
- Documentacao completa em `.wiki/` (esta revisao).
- Repositorio GitHub: `git@github.com:liderbrinquedos/wmsfull.git`.
- **Nao** em producao ainda.
- **Sem** testes, **sem** migracoes (Alembic), **sem** importacao de dados.
- 28 itens de debito tecnico priorizados em `backlog/tech-debt.md`.

## Pendencias Decisorias

1. **Deploy de producao** - plataforma, dominios, env vars, backup, migracao do schema.
2. **Fontes de dados** - de onde vem produtos, NFs e posicoes de estoque.
   Ver `[[integrations/data-sources]]`.
3. **Fila offline** - o PWA e instalavel, mas nao tem fila de bipagens/entregas
   (`ADR-004`).
4. **Seguranca** - `SECRET_KEY`, credenciais de demonstracao no bundle, CORS.

## Convencoes

- Idioma: portugues (markdown da wiki sem acentos, links `[[nome-do-arquivo]]`)
- Commits: Conventional Commits em portugues, branch `main`
- Datas: `datetime.utcnow` (UTC) no backend, `pt-BR` no frontend
- API: prefixos por modulo (`/wms`, `/conference`, `/delivery`, `/admin`)
- Upload: `uuid4` + extensao original, servido em `/uploads/`
- Sessao: JWT em `localStorage` (`token`, `user`)

## Links Relacionados

- `[[architecture/system-overview]]` - componentes, tabelas, endpoints
- `[[architecture/data-flow]]` - fluxos de login, WMS, conferencia e entrega
- `[[brain/project-snapshot]]` - estado tecnico do codigo
- `[[brain/current-focus]]` - o que esta em aberto agora
- `[[decisions/005-consolidacao-de-wms-conferencia-entrega]]` - por que um app so
