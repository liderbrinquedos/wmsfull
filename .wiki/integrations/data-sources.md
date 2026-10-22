# Data Sources - WMSFull

> **Ultima revisao:** 2026-10-22
> **Status:** decidido — ver `docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`

De onde vem cada dado do WMSFull, quem e dono de cada campo e por qual canal ele entra.

---

## 1. Matriz de fontes

| Dado | Fonte | Canal | Dono do campo | Cadencia |
|---|---|---|---|---|
| `codigo`, `referencia`, `descricao` | ERP | agente push | ERP | 3x/dia |
| `ean13` (unidade) | ERP | agente push | ERP (ficha preenche se vazio) | 3x/dia |
| `qtd_embalagem` | ERP | agente push | **ERP** | 3x/dia |
| `ean14` (caixa master) | `FICHA TECNICA *.xlsx` | upload no admin | ficha / admin | sob demanda |
| `localizacao` | `Localizacao.xlsx` | upload no admin | ficha / edicao manual no WMS | sob demanda |
| `estoque_caixas` | WMSFull | tela WMS | WMSFull | manual |
| Notas fiscais + itens | ERP | agente push | ERP (so em `pendente`) | 3x/dia |
| Usuarios | WMSFull | tela admin | WMSFull | manual |
| Entregas, canhotos, reagendamentos | WMSFull | app | WMSFull | tempo real |

Regra que resume tudo: **o ERP manda identidade e nota; o WMSFull manda endereco, estoque
e operacao.** O sync nunca escreve em `localizacao`, `estoque_caixas` nem `ean14`.

---

## 2. Fronteira de rede

O ERP so responde **dentro da rede da empresa**. O app e **publico** (celular pessoal com
4G). Por isso o dado atravessa a fronteira sempre de dentro para fora:

```
ERP (rede interna)  ->  agente wmsfull-sync  ->  HTTPS  ->  API publica (Coolify)
```

O app publico nunca inicia conexao para dentro da rede. Ver
[[decisions/007-ingestao-por-agente-push]].

O fallback manual tambem respeita a direcao: o botao "Sincronizar agora" grava um pedido em
`sync_requests`, e o agente pergunta a cada 2 minutos se ha pedido pendente.

---

## 3. Canais de entrada

### 3.1 Agente push (`/sync/*`)

- Autenticacao: header `X-Sync-Key` (separada do JWT de usuario).
- `POST /sync/produtos` - lote de ate 500, upsert por `codigo`.
- `POST /sync/nf` - lote de NFs com itens, upsert por `chave_nfe`.
- `GET /sync/requests/pending` - o agente consulta.
- `POST /sync/runs/{id}/finish` - contagens, duracao e erros.
- Erro **por item**, nunca por lote.

### 3.2 Upload de planilhas (`/import/*`)

Duas etapas obrigatorias, para que ninguem aplique um arquivo sem ver o efeito:

1. `POST /import/preview` - valida e devolve o relatorio sem gravar.
2. `POST /import/apply` - aplica o que passou e registra em `sync_runs`.

### 3.3 Cadastro manual no admin

CRUD de `ean13`/`ean14` por produto, para os itens sem ficha e para corrigir codigo
errado. Grava `ean13_origem`/`ean14_origem = 'manual'`.

---

## 4. Arquivos de referencia (formato real medido)

### 4.1 `FICHA TECNICA *.xlsx`

Cabecalho na **linha 2**. Juncao com o catalogo por **`REF.`** (`products.referencia`).
| Coluna | Uso |
|---|---|
| `REF.` | chave de juncao |
| `DESCRICAO` | conferencia (FANDOMBOX nao tem) |
| `LINHA` | conferencia / agrupamento |
| `CX MASTER` | **apenas conferencia** — divergencias vao para o relatorio |
| `EAN 13` | `products.ean13` |
| `DUN 14` (ou `DUN14`) | `products.ean14` |
| `DUN INT` | ignorado (2 de 224 linhas) |

Situacao em 2026-10-22:

| Ficha | SKUs |
|---|---|
| APOLO | 112 |
| FANDOMBOX | 155 |
| LIDER | 224 |
| **Total** | **491** de 1.997 SKUs (24,6%) |

Pendencia: **1.508 SKUs sem codigo de caixa**. Ate a ficha chegar, a bipagem desses itens
nao tem codigo de caixa e o operador usa o botao "+1 Caixa".

Anomalias conhecidas na origem: 2 EAN13 e 12 DUN14 com digito verificador invalido, 2
DUN14 com tamanho errado, 24 divergencias de `CX MASTER`. Todas viram linha de relatorio no
import.

### 4.2 `Localizacao.xlsx`

Aba `Dados`, cabecalho na linha 1, 1.998 SKUs.

| Coluna | Uso |
|---|---|
| `Codigo` | juncao com `products.codigo` |
| `Referencia` | conferencia |
| `Descricao` | conferencia |
| `Quantidade de embalagens` | **apenas conferencia** (ERP prevalece) |
| `Localizacao` | `products.localizacao` |

Situacao: 1.381 sem localizacao, 49 com texto livre (`MOSSORO`, `SACARIA`,
`BOLAS CHEIAS`), 2 com endereco duplo (`A041A/A042A`), 60 sem `Quantidade de embalagens`.

Textos livres entram como estao. O frontend deve tratar localizacao fora do padrao
`RUA + 3 digitos + NIVEL` como texto simples, sem tentar decodificar rua/prateleira.

### 4.3 Os arquivos nao ficam no repositorio

`*.xlsx` na raiz e ignorado pelo `.gitignore` (sao dados de entrada, nao codigo). A copia de
referencia fica na maquina que opera o app; o que e versionado e o resultado do import,
registrado em `sync_runs`.

---

## 5. Estado atual do codigo (antes da implementacao)

Nada disso existe ainda. Hoje:

- nao ha `/sync/*` nem `/import/*`;
- nao ha `ean13`/`ean14` no modelo (apenas `codigo_barras_master`);
- nao ha tabelas de controle (`sync_runs`, `sync_run_errors`, `sync_requests`);
- nao ha CRUD de produto no admin;
- o catalogo vem inteiro do `seed.py`.

A tela do WMS exibe "Carregando produtos do ERP..." e **nao ha ERP conectado** — mensagem a
corrigir quando o sync entrar.

---

## 6. Precedentes na familia

| Projeto | Mecanismo |
|---|---|
| `logconf` | import `.xlsx` via admin (`POST /api/produtos/import`, `/api/notas/import`) |
| `logstock` | import CSV/Excel com SheetJS e exportacao XLSX |
| `logdriver` | import `.xlsx` + sync OneDrive |

O import de planilha continua sendo o padrao da casa para dado que nasce em arquivo. O
diferencial aqui e o agente push para o dado que so existe no banco do ERP.

---

## Links Relacionados

- `docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`
- [[decisions/007-ingestao-por-agente-push]]
- [[decisions/006-alembic-e-migracoes]]
- [[brain/business-rules]]
- [[architecture/data-flow]]
