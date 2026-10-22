# ADR-005: Consolidacao de WMS, Conferencia e Entrega em um unico app

> **Data:** 2026-10-22
> **Status:** accepted
> **Autor:** liderbrinquedos

## Contexto

A familia de projetos logisticos da empresa cresceu como tres aplicacoes separadas:

| Projeto | Funcao | Stack | Banco |
|---|---|---|---|
| `logstock` (WMS Flow) | Enderecamento e estoque | Vanilla JS + FastAPI | SQLite |
| `logconf` (Conferencia NF-e) | Bipagem de notas | Vue 3 + Express | SQLite (sql.js) |
| `logdriver` (LiderLog) | Entregas com canhoto | FastAPI + PWA | SQLite |

Cada uma resolveu bem o seu problema isolado, mas tres problemas estruturais se acumularam:

1. **Cadastros duplicados.** Produtos, notas e usuarios eram cadastrados em cada sistema,
   com codigos e nomenclaturas diferentes.
2. **Nenhum handoff.** Uma nota conferida no `logconf` nao aparecia na fila do
   `logdriver`; o motorista recebia a lista por fora. O `logstock` nao sabia nada sobre
   movimento de carga.
3. **Tres deploys, tres bancos, tres curvas de aprendizado.** Um operador que so
   conferecia notas e um que so entregava precisavam de dois logins.

O WMSFull nasce da constatacao de que **o valor esta no encadeamento das operacoes**,
nao em cada operacao isolada: enderecar -> separar -> bipar -> expeder -> entregar com
prova.

## Decisao

**Consolidar as tres operacoes em uma unica aplicacao**, mantendo a separacao logica em
modulos:

- **WMS** - catalogo, localizacao e estoque (herda o `logstock`).
- **Conferencia** - bipagem de NF e calculo de caixas (herda o `logconf`).
- **Entrega** - baixa com canhoto e reagendamento (herda o `logdriver`).

O encadeamento e real e vive no banco:

```
Produto no estoque (WMS)
   -> NF com itens (Conferencia)
      -> bipagem: caixas_lidas / caixas_necessarias
         -> NF conferida
            -> motorista atribuido  => em_entrega
               -> canhoto ou reagendamento => entregue | reagendado
```

Decisoes de design derivadas da consolidacao:

- **Um unico cadastro de produtos.** A NF referencia `products.id` diretamente, com
  `qtd_embalagem` congelado como snapshot no item da nota.
- **Um unico cadastro de usuarios** com 4 perfis, e o `motorista_id` da NF faz o
  handoff entre conferencia e entrega sem segunda lista.
- **Um unico `status` da NF** como maquina de estados que atravessa os modulos
  (6 estados: `pendente` -> `em_conferencia` -> `conferida` -> `em_entrega` ->
  `entregue` | `reagendado`).
- **Endpoints espelham os modulos** (`/wms`, `/conference`, `/delivery`, `/admin`), o que
  torna o mapeamento tela -> rota -> endpoint trivial de auditar.

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| Manter 3 apps + integracao entre eles | Mudanca minima | Handoff continua manual; 3 deploys; duplicacao mantida |
| Migrar para um unico ERP comercial | Robusto, padrao de mercado | Custo, licenca, e a empresa nao tem esse processo maduro |
| Consolidar em um app mas com 3 bancos | Modularidade de dados | Nao resolve o handoff; duplica a infraestrutura sem ganho |
| **Um app, um banco (decidido)** | Handoff nativo; um cadastro; um deploy | App maior; operacoes nao implantaveis separadamente |

## Consequencias

- **Positivas:** o ciclo completo e rastreavel em uma unica base; o motorista ve a fila
  de entrega que veio da conferencia do mesmo dia; um unico login; um unico backup; a
  documentacao (`.wiki/`) cobre o sistema inteiro.
- **Impacto no codigo:** `src/modules/` tem 4 diretorios; `app/routers/` tem 5 routers
  na mesma granularidade; `models/nota_fiscal.py` concentra o `status` que atravessa
  modulos.
- **Impacto na equipe:** o dominio passou a ter **um** glossario
  (`.wiki/brain/glossary.md`) em vez de tres. Quem operava so um dos sistemas agora
  precisa conhecer o vocabulario completo (canhoto, caixa master, expedicao).
- **Negativas:**
  - **Nao ha "modulo desativado"**: nao da para desabilitar, por exemplo, a Entrega
    para um cliente que so usa o armazem.
  - O estoque **nao e debitado** na bipagem nem na entrega - a consolidacao unificou a
    **estrutura**, mas nao a **contabilidade** (ver backlog P3 / discussao aberta).
  - O `logconf` e o `logdriver` continuam existindo como legado; a migracao dos dados
    reais ainda nao foi planejada.

## Pendencias

- Definir a fonte de verdade do estoque: o ERP, o WMSFull, ou os dois com reconciliacao.
- Definir a **fonte de dados** de cada entidade (ver `[[integrations/data-sources]]`).
- Planejar a migracao dos dados dos sistemas legados.

## Links Relacionados

- [[architecture/system-overview]]
- [[architecture/data-flow]]
- [[brain/business-rules]]
- [[decisions/001-arquitetura-fastapi-react-pwa]]
- [[projects/wmsfull]]
