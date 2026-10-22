# Data Sources - WMSFull

> **Ultima revisao:** 2026-10-22
> **Status:** EM ABERTO - decisao pendente no brainstorm de producao.

Este documento registra **de onde vem cada dado** do WMSFull. Ele foi criado vazio de
proposito: a definicao das fontes de dados e uma decisao pendente do brainstorm de
producao (ver `.wiki/brain/current-focus.md`).

---

## Estado Atual (fato)

**Nao existe nenhuma entrada de dados alem do seed.**

```
docker compose up
  └─▶ python app/seed.py
        ├─ Base.metadata.create_all(engine)   ← cria o schema
        └─ popula (se users estiver vazio):
              5 usuarios | 5 produtos | 3 notas fiscais | 6 itens | 0 entregas
```

| Entidade | Origem hoje | Como entra | Volume |
|---|---|---|---|
| Usuarios | `seed.py` | arquivo fixo no codigo | 5 |
| Produtos | `seed.py` | arquivo fixo no codigo | 5 |
| Notas fiscais | `seed.py` | arquivo fixo no codigo | 3 |
| Itens da NF | `seed.py` | arquivo fixo no codigo | 6 |
| Entregas | - | action do motorista no app | 0 |
| Localizacao do estoque | `seed.py` + edicao manual pela tela WMS | PUT `/wms/products/{id}/location` | - |

**Nao existe:**
- importacao de `.xlsx` ou `.csv`;
- integracao com ERP (nenhuma API, webhook ou leitura de banco externo);
- cadastro de produtos ou NFs pela API (nao ha endpoint `POST /wms/products` nem
  `POST /conference/nf`);
- tela de cadastro de produtos no frontend.

> A interface ja exibe "Carregando produtos do ERP..." (`frontend/src/modules/wms/WMSPage.tsx`),
> mas **nao ha ERP conectado** - a mensagem e enganosa.

---

## Precedentes na familia de projetos

| Projeto | Mecanismo de entrada | Detalhe |
|---|---|---|
| `logconf` (Conferencia NF-e) | **Import `.xlsx` via admin** | `POST /api/produtos/import` e `POST /api/notas/import`; colunas `codprod`, `referencia`, `descprod`, `qtdemb`, `ean13`, `ean14` para produtos e `nunota`, `numnota`, `codparc`, `razaosocial`, `codprod`, `referencia`, `qtd` para notas |
| `logstock` (WMS Flow) | Import CSV/Excel (SheetJS) | Catalogo de produtos e locais, com exportacao para XLSX |
| `logdriver` (LiderLog) | Import `.xlsx` + sync OneDrive | Entregas importadas e sincronizadas com OneDrive (OAuth client credentials) |

**Padrao da casa:** planilha como ponte entre ERP e aplicacao.

---

## Perguntas a Resolver (brainstorm de producao)

### 1. Catalogo de produtos
- [ ] ERP com API consultavel? (qual sistema, qual endpoint, qual autenticacao)
- [ ] `.xlsx` no padrao do `logconf`? (provavelmente o caminho mais curto)
- [ ] Cadastro manual pela tela admin?
- [ ] Frequencia: carga inicial + atualizacao por lote (diario) ou sob demanda?
- [ ] Quem e a fonte de verdade do `estoque_caixas` e da `localizacao`?
- [ ] Como entra o `codigo_barras_master` (chave da bipagem)?

### 2. Notas fiscais
- [ ] As NFs sao geradas no ERP e exportadas, ou digitadas no app?
- [ ] Os itens da NF trazem `qtd_nota` e `qtd_embalagem` (snapshot), ou so `qtd_nota`?
- [ ] Importacao por arquivo ou leitura direta do ERP?
- [ ] Como se evita duplicidade (chave da NF: `numero`?) e reimportacao de NF ja conferida?

### 3. Posicoes de estoque
- [ ] A localizacao (`RUA+PRAT+POS+NIVEL`) existe no ERP ou e exclusiva do WMSFull?
- [ ] Quem pode alterar: supervisor pelo app (como hoje) ou o ERP?
- [ ] Ha um catalogo de posicoes validas (tabela de enderecos)?

### 4. Usuarios
- [ ] Cadastro no app (como hoje) ou provisionado por SSO/LDAP?
- [ ] O perfil do motorista se sincroniza com o cadastro de motoristas do ERP?

### 5. Divergencia e conciliação
- [ ] Se o ERP e a fonte de verdade do estoque, como o WMSFull reconcilia?
- [ ] Debito de estoque: acontece na bipagem, na entrega ou no ERP?
- [ ] Historico de alteracoes (auditoria) - necessario?

---

## Impacto Tecnico de Cada Opcao

| Opcao | Esforco | Praticidade |
|---|---|---|
| Import `.xlsx` (admin) | Baixo - reusa o padrao do `logconf` | Alta; exige planilha padronizada |
| API do ERP | Medio-Alto - depende do ERP e da sua API | Depende do fornecedor |
| Leitura direta do banco do ERP | Alto - schema desconhecido, risco de lock | Baixa |
| Cadastro manual no app | Baixo - CRUD novo + tela | Baixa para volume alto |

---

## Recomendacao Preliminar (a confirmar no brainstorm)

1. **Curto prazo:** import `.xlsx` no padrao do `logconf` para produtos e NFs -
   resolve o bloqueio de producao com o menor custo e segue o padrao da casa.
2. **Medio prazo:** integracao com a API do ERP para carga incremental, se o ERP
   oferecer endpoint estavel.
3. **Estoque:** o WMSFull controla **localizacao** e **conferencia**; o ERP controla
   **quantidade**. Reconciliacao por lote.
4. **Usuarios:** manter cadastro no app (baixo volume) ate necessidade de SSO.

---

## Links Relacionados

- [[brain/business-rules]]
- [[integrations/api-catalog]]
- [[architecture/data-flow]]
- [[projects/wmsfull]]
- logconf - catalogo de APIs: `/home/lider/project/aplicacoes/logconf/.wiki/integrations/api-catalog.md`
  (projeto irmao, fora deste repositorio)
