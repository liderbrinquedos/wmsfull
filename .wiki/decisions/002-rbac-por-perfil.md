# ADR-002: Controle de acesso por perfil (RBAC)

> **Data:** 2026-10-22
> **Status:** accepted
> **Autor:** liderbrinquedos

## Contexto

O WMSFull tem quatro tipos de usuario funcionais e bem distintos entre si:

- **operador** - bipa as caixas no docks e ve o catalogo do armazem;
- **motorista** - executa as entregas em campo, com a camera do celular;
- **supervisor** - ajusta estoque, expede NFs e acompanha relatorios;
- **admin** - gerencia usuarios e tem acesso total.

As operacoes de campo sao feitas em celular, em rede instavel e com telas pequenas. A
consequencia pratica e que **um erro de permissao custa minutos ou uma entrega perdida**:
o motorista nao deve conseguir alterar a localizacao do estoque, e o operador nao deve
conseguir designar entregas.

O `logconf` usava `role` unica e `adminOnly` middleware; o `logdriver` usava `admin`,
`motorista` e `monitor`. O WMSFull precisa de um eixo adicional: quem pode **editar** e
quem so pode **ler** dentro do mesmo modulo (WMS).

## Decisao

Adotar **RBAC por perfil**, com o perfil gravado no banco (`users.perfil`, enum nativo
`perfil_enum`) e **espelhado no token JWT** (claim `perfil`).

Quatro perfis: `admin`, `supervisor`, `operador`, `motorista`.

A permissao e aplicada em **duas pontas**:

1. **Backend (autoritativa)** - `get_current_user` valida o token e rejeita usuario
   inativo; `require_roles(*roles)` e a dependencia de rota que devolve 403 com a lista de
   perfis necessarios.
2. **Frontend (experiencia)** - `AuthGuard` recebe `allowedRoles` por rota e redireciona
   para a rota padrao do perfil quando o acesso e negado.

O redirecionamento por perfil define o "home" de cada um:
`motorista -> /delivery`, `operador -> /conference`, demais -> `/wms`.

**Desativar** (nao apagar) e o mecanismo de revogacao: `users.ativo = false` bloqueia o
login e invalida imediatamente qualquer token ja emitido.

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| Permissoes por papel livre (tabela de ACL) | Flexivel | 4 perfis cobrem 100% do caso; ACL traz complexidade sem ganho |
| So frontend (esconder botoes) | Implementacao simples | Nao e seguranca: qualquer um pode chamar a API direto |
| So backend (403) | Autoritativo | UX ruim: o usuario so descobre o bloqueio depois de tentar a acao |
| Perfis dentro do enum vs tabela | Enum nativo do Postgres e simples | Adicionar perfil exige migration |

## Consequencias

- **Positivas:** matriz de permissao explicita e documentavel
  (`.wiki/brain/business-rules.md`); usuario inativo perde acesso na hora; a UI esconde o
  que o usuario nao pode fazer, e o backend garante.
- **Impacto no codigo:** `require_roles` no `Depends` de cada endpoint sensivel;
  `AuthGuard allowedRoles={[...]}` em cada rota do `App.tsx`; botaes condicionais por
  `canEdit`/`isAdmin` dentro dos modulos.
- **Impacto na equipe:** novos perfis exigem enum novo (migration) e revisao da matriz em
  dois lugares.
- **Negativas e riscos conhecidos:**
  - O `AuthGuard` confia no `perfil` reidratado do `localStorage` - o backend e quem
    decide de verdade, mas a UI pode exibir acoes que retornarao 403.
  - `GET /admin/motoristas` exige `admin|supervisor`, e o `ConferenceSession` (acessivel
    por `operador`) o chama para popular o select de expedicao - **403 para o operador**
    (backlog P1-04).
  - `POST /delivery/nf/{id}/deliver` e `/reschedule` usam apenas `get_current_user`, sem
    `require_roles`: `admin`, `supervisor` e `operador` tambem podem dar baixa
    (backlog P1-05).
  - `PUT /admin/users/{id}` nao valida o perfil enviado, ao contrario do `POST`
    (backlog P1-07).

## Links Relacionados

- [[brain/business-rules]]
- [[brain/api-contracts]]
- [[architecture/system-overview]]
- [FastAPI - Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
