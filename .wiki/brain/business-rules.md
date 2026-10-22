# Business Rules - WMSFull

> **Ultima revisao:** 2026-10-22
> Fonte: `backend/app/routers/*.py`, `backend/app/models/*.py`, `frontend/src/modules/*`

---

## 1. Autenticacao e Sessao

- Login por **email + senha** (`POST /auth/login`, formulario OAuth2 password).
- Senhas com **bcrypt** (`passlib[bcrypt]`), truncadas em 72 bytes (limite do bcrypt).
- Token **JWT HS256** com payload `{sub: user.id, perfil: user.perfil}`.
- Validade padrao: **480 minutos** (8 horas) - `ACCESS_TOKEN_EXPIRE_MINUTES`.
- Um usuario **inativo** (`ativo = false`) nao autentica (403 no login) e perde o acesso
  imediatamente, mesmo com token valido (`get_current_user` checa `ativo`).
- **Nao ha logout no backend** (JWT e stateless). O logout do frontend so limpa o
  `localStorage`; o token continua valido ate expirar.
- A sessao sobrevive ao reload porque `token` e `user` ficam no `localStorage`;
  `init()` revalida via `GET /auth/me` e limpa o storage em caso de falha.

## 2. Perfis (RBAC)

Enum `perfil_enum`: `admin`, `supervisor`, `operador`, `motorista`.

| Endpoint | admin | supervisor | operador | motorista |
|---|---|---|---|---|
| `GET /auth/me` | sim | sim | sim | sim |
| `GET /wms/products`, `/wms/products/{id}`, `/wms/stats` | sim | sim | sim | sim |
| `PUT /wms/products/{id}/location` | sim | sim | nao | nao |
| `GET /conference/nf`, `/conference/nf/{id}` | sim | sim | sim | sim |
| `POST /conference/nf/{id}/start`, `/scan` | sim | sim | sim | nao |
| `POST /conference/nf/{id}/assign` | sim | sim | nao | nao |
| `GET /delivery/nf` | todas | todas | todas | proprias |
| `POST /delivery/nf/{id}/deliver`, `/reschedule` | sim | sim | sim | proprias |
| `GET/POST/PUT /admin/users` | sim | nao | nao | nao |
| `GET /admin/motoristas`, `/admin/reports/deliveries`, `/admin/overview` | sim | sim | nao | nao |

Regras de negocio relacionadas:
- O perfil **motorista** so enxerga as NFs com `nf.motorista_id == seu id`.
- O `GET /admin/motoristas` devolve **somente** usuarios ativos com perfil `motorista`.
- No frontend, o `AuthGuard` redireciona para a rota padrao do perfil quando o acesso e
  negado (`motorista` -> `/delivery`, `operador` -> `/conference`, demais -> `/wms`).

## 3. Enderecamento de Estoque (WMS)

Formato normalizado: **`RUA` + `PRAT` + `POS(2 digitos)` + `NIVEL`** -> 5 caracteres.

| Parte | Tamanho | Exemplo | Regra |
|---|---|---|---|
| RUA | 1 char, A-Z | `F` | letra unica, maiuscula |
| PRAT | 1 digito, 1-9 | `1` | prateleira |
| POS | 2 digitos, `01`-`99` | `02` | posicao, preenchido com `padStart(2, '0')` |
| NIVEL | 1 char, A-Z | `C` | nivel, maiusculo |

Exemplo: `F102C` = rua F, prateleira 1, posicao 02, nivel C.

- O `LocationBadge` decodifica a posicao e mostra tooltip
  "Rua X - Prateleira Y - Posicao Z - Nivel N".
- O estoque e contado em **caixas master**: `estoque_caixas`.
- A unidade de display e `estoque_caixas * qtd_embalagem`.
- `GET /wms/stats` agrupa por **primeiro caractere** da localizacao (a rua) e sinaliza
  `estoque_baixo` quando `estoque_caixas < 5`.
- Busca de produtos: `ILIKE` com OR em `codigo`, `referencia` e `descricao`, ordenada por
  `localizacao`.

## 4. Codigo de Barras

- O produto tem um **codigo de barras master** (`codigo_barras_master`, unico).
- A bipagem usa **esse** codigo, nao o codigo do cliente nem o EAN do item.
- O frontend envia `codigo_barras` e o backend resolve o produto por
  `Product.codigo_barras_master`.

## 5. Conferencia de Carga

Fluxo de uma nota:

1. A NF nasce em `pendente`.
2. `POST /conference/nf/{id}/start` exige `status == "pendente"`; senao devolve 400.
   Em caso contrario, vira `em_conferencia`.
3. `POST /conference/nf/{id}/scan`:
   - Exige `status == "em_conferencia"` (400 caso contrario).
   - Codigo de barras desconhecido -> **422** "Codigo de barras nao reconhecido".
   - Produto que nao pertence a NF -> **422** "Produto nao pertence a esta NF".
   - Item ja totalmente conferido -> **400** "Item ja completamente conferido".
   - Incrementa `caixas_lidas`; quando `caixas_lidas >= caixas_necessarias`, marca
     `conferido = true`.
   - Quando **todos** os itens da NF ficam conferidos, a NF passa para `conferida`.
4. `POST /conference/nf/{id}/assign`:
   - Exige `status == "conferida"` (400 caso contrario).
   - O `motorista_id` deve existir e ter perfil `motorista` (404 caso contrario).
   - Grava `nf.motorista_id` e move a NF para `em_entrega`.

### Calculo de caixas

```
caixas_necessarias = ceil(qtd_nota / qtd_embalagem)
```

- `qtd_nota` = unidades na nota fiscal.
- `qtd_embalagem` = **snapshot** do `Product.qtd_embalagem` no momento em que a NF e criada
  (nao e lida do produto em tempo de bipagem).
- `caixas_lidas` e incrementada de **1 em 1** (uma bipagem = uma caixa master).
- `conferido` = `caixas_lidas >= caixas_necessarias`.

### Estados possiveis de uma NF

`pendente` -> `em_conferencia` -> `conferida` -> `em_entrega` -> `entregue` | `reagendado`

### Observacoes

- **Nao existe lock de nota**: dois operadores podem bipar a mesma NF ao mesmo tempo.
- O `estoque_caixas` do produto **nao e debitado** na bipagem nem na entrega.
- A NF nao registra **quem** fez a conferencia (sem `usuario_id` em `nf_itens`).
- Motivos de falha de entrega sao **6 opcoes fixas** no frontend (sem texto livre):
  Cliente Ausente, Endereco Nao Localizado, Cliente Recusou Receber, Estabelecimento
  Fechado, Avaria na Mercadoria, Outro Motivo.

## 6. Entrega

- `GET /delivery/nf` devolve NFs com status `em_entrega`, `entregue` ou `reagendado`.
  Para `motorista`, apenas as com `motorista_id` proprio.
- `POST /delivery/nf/{id}/deliver`:
  - 404 se a NF nao existe.
  - 400 "NF nao esta em entrega" se `status != "em_entrega"`.
  - 403 "NF nao atribuida a voce" se o ator for motorista e a NF nao for sua.
  - A foto e **opcional** (`multipart/form-data`, campo `foto`).
  - Cria `Delivery(status="entregue")` e move a NF para `entregue`.
- `POST /delivery/nf/{id}/reschedule`: mesmas validacoes; grava `motivo_falha` e
  `data_reagendamento` e move a NF para `reagendado`.
- A **foto do canhoto** e salva como `{uuid4}{ext}` em `UPLOAD_DIR`; a URL relativa
  `/uploads/<arquivo>` fica em `Delivery.foto_canhoto_url`.
- A foto e gravada **sem compressao**: Pillow esta no `requirements.txt` mas nao e usado
  (ver backlog P2-02).
- O `Delivery.motorista_id` gravado e sempre o do **usuario que executou a acao**, nao o da
  NF (consequencia de `require_roles` ausente - ver backlog P1-05).

## 7. Usuarios

- `POST /admin/users` valida email duplicado (400) e perfil invalido (400).
- `PUT /admin/users/{id}` atualiza apenas campos enviados (`nome`, `email`, `perfil`,
  `ativo`). **Nao** altera a senha e **nao** valida o perfil (ver backlog P1-07).
- Desativar um usuario e o mecanismo de "demissao": `get_current_user` passa a rejeitar
  o token.

## 8. Dados de Exemplo (seed)

| Tipo | Quantidade | Detalhe |
|---|---|---|
| Usuarios | 5 | 1 admin, 1 supervisor, 1 operador, 2 motoristas |
| Produtos | 5 | `codigo` 21-25, `referencia` 49-53, EAN `789123456002x` |
| Notas fiscais | 3 | `NF-2024-001` a `NF-2024-003`, 2 itens cada |
| Entregas | 0 | tabela `deliveries` fica vazia |

- O seed e **idempotente**: se `users` ja tiver registros, ele nao insere nada.
- As tabelas sao criadas por `Base.metadata.create_all` **dentro do seed**
  (ver `[[decisions/003-schema-criado-por-seed-sem-alembic]]`).

## 9. Formato de Localizacao - Fuso e Datas

- Datas no backend: `datetime.utcnow` (UTC, depreciado no Python 3.12).
- Datas no frontend: `new Date(...).toLocaleString('pt-BR')`.
- Conhecido: o default da data de reagendamento usa `toISOString()` (UTC) e erra entre
  00:00 e 03:00 no fuso America/Sao_Paulo (backlog P3-03).
