# ADR-001: Arquitetura FastAPI + React PWA + PostgreSQL

> **Data:** 2026-10-22
> **Status:** accepted
> **Autor:** liderbrinquedos

## Contexto

O WMSFull consolida tres operacoes logisticas que antes eram atendimento por projetos
separados: `logconf` (Conferencia NF-e, Vue + Express + SQLite), `logdriver` (LiderLog,
entregas, FastAPI + SQLite + PWA) e `logstock` (WMS, PWA offline-first).

Cada projeto isolado carregava seu proprio stack, seu proprio cadastro de usuarios e seu
proprio banco. O cadastro de produtos, o cadastro de notas e o cadastro de usuarios
ficaram duplicados entre os sistemas, e nenhuma operacao enxergava a outra: uma nota
conferida na aplicacao de conferencia nao aparecia na fila de entregas.

## Decisao

Adotar uma **aplicacao unica** com tres modulos (WMS, Conferencia, Entrega) sobre um
stack unico:

- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL 16, empacotado em container Python
  3.12 slim.
- **Frontend:** SPA React 18 + TypeScript + Vite, com PWA instalavel (vite-plugin-pwa +
  Workbox), empacotada em container nginx.
- **Orquestracao:** Docker Compose com 3 servicos (db, api, web) e volumes nomeados para
  persistencia do banco e dos uploads.
- **Autenticacao:** JWT stateless com guarda de perfil em duas pontas (backend via
  `require_roles`, frontend via `AuthGuard`).

O PostgreSQL substitui o SQLite dos projetos antecessores porque o volume precisa
suportar concorrencia de leitura (diversas telas de listagem) e porque as transicoes de
status da NF exigem integridade referencial com `ON DELETE CASCADE` nos itens.

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| Manter os 3 projetos separados | Menor mudanca; cada um ja funciona | Cadastros duplicados; nota conferida nao chega na entrega; 3 deploys |
| SPA React + backend Node/Express | Mesma stack no front e no back; `logconf` ja usa | Migração do backend FastAPI (JWT, Pillow, upload) custosa; ecosystem Python ja consolidado na familia `logdriver` |
| Next.js (SSR) | SSR, rotas da API no mesmo projeto | Deploy mais complexo; app essencialmente cliente (operacao em campo), SSR nao agrega |
| Flask/Django | ORM e admin prontos | Mais pesado; admin nativo nao substitui a tela `/admin` desenhada para o perfil supervisor |

## Consequencias

- **Positivas:** um unico cadastro de produtos, usuarios e notas; o fluxo
  `conferir -> expedir -> entregar` fica inteiro em um app; um unico banco, um unico
  deploy; a stack reaproveita o padrao ja validado no `logdriver`.
- **Impacto no codigo:** os routers espelham os modulos de tela (`wms`, `conference`,
  `delivery`, `admin`); o frontend tem 4 diretorios em `src/modules/` com a mesma
  estrutura.
- **Impacto na equipe:** knowledge base unica (`.wiki/`); o padrao de documentacao e de
  commit (Conventional Commits em portugues) ja e o da familia de projetos.
- **Negativas:** o tamanho do app cresce; as 3 operacoes nao podem ser implantadas de
  forma independente; o frontend acumulou duplicacao de codigo de loading (5 telas com
  `useState` + `useEffect` + axios) em vez de TanStack Query, que esta declarado e nao
  usado.

## Links Relacionados

- [[architecture/system-overview]]
- [[architecture/data-flow]]
- [[decisions/002-rbac-por-perfil]]
- [[decisions/005-consolidacao-de-wms-conferencia-entrega]]
- [FastAPI](https://fastapi.tiangolo.com/)
