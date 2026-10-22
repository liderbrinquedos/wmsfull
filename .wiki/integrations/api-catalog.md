# API Catalog - WMSFull

> **Ultima revisao:** 2026-10-22
> Catalogo completo dos endpoints da API. Documentacao viva do backend FastAPI em
> `http://localhost:8005/docs`.

## Autenticacao

Todas as rotas (exceto `/auth/login`, `/` e `/health`) exigem:
```
Authorization: Bearer <token>
```

Token JWT HS256, payload `{sub: <user_id>, perfil: <perfil>}`, validade 480 min.

| Erro | Significado |
|---|---|
| 401 | Token invalido, expirado ou usuario inativo |
| 403 | Perfil sem permissao (body traz a lista de perfis necessarios) |

---

## Health

### GET `/`
Responde `{"status":"ok","app":"WMSFull API","version":"1.0.0"}`.

### GET `/health`
Responde `{"status":"healthy"}`.

---

## Auth

### POST `/auth/login`
Acesso publico. Formulario `application/x-www-form-urlencoded` (`OAuth2PasswordRequestForm`).

**Body**
```
username=admin@log.com&password=admin123
```

**Resposta 200**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "u1",
    "nome": "Admin Master",
    "email": "admin@log.com",
    "perfil": "admin",
    "ativo": true
  }
}
```

**Erros**
| Codigo | Detalhe |
|---|---|
| 401 | "Email ou senha incorretos" |
| 403 | "Usuario inativo" |

### GET `/auth/me`
Qualquer usuario autenticado e ativo. Devolve o `UserOut` do token.

---

## WMS

Prefixo `/wms`. Gerencia o catalogo e o enderecamento de estoque.

### GET `/wms/products`
Qualquer autenticado. Lista com busca opcional.

**Query**
| Param | Tipo | Descricao |
|---|---|---|
| `search` | string (opcional) | Casa por `codigo`, `referencia` ou `descricao` (ILIKE `%termo%`) |

**Resposta 200** - `ProductOut[]`, ordenado por `localizacao`
```json
[
  {
    "id": "p1",
    "codigo": "21",
    "referencia": "49",
    "descricao": "Caixa Produto A",
    "qtd_embalagem": 6,
    "localizacao": "F102C",
    "estoque_caixas": 20,
    "codigo_barras_master": "7891234560021"
  }
]
```

### GET `/wms/products/{product_id}`
Qualquer autenticado. **404** "Produto nao encontrado".

### PUT `/wms/products/{product_id}/location`
**Permissao:** `admin`, `supervisor`.

**Body** (ambos os campos opcionais; so os enviados sao aplicados)
```json
{ "localizacao": "F102C", "estoque_caixas": 20 }
```

**Resposta 200** - `ProductOut` atualizado.

**Erros:** 404 "Produto nao encontrado" | 403 "Acesso negado. Perfil necessario: ..."

### GET `/wms/stats`
Qualquer autenticado. Retorna `dict` (sem `response_model`).

**Resposta 200**
```json
{
  "total_produtos": 5,
  "total_caixas": 85,
  "estoque_baixo": ["p3"],
  "por_rua": { "A": 1, "B": 1, "C": 1, "D": 1, "F": 1 }
}
```

> `estoque_baixo` = ids com `estoque_caixas < 5`. `por_rua` agrupa pelo 1o caractere da
> localizacao.

---

## Conferencia

Prefixo `/conference`. Bipagem de notas fiscais.

### GET `/conference/nf`
Qualquer autenticado. Lista as NFs, da mais recente para a mais antiga.

**Query**
| Param | Tipo | Descricao |
|---|---|---|
| `status` | string (opcional) | Filtro exato pelo status |

**Resposta 200** - `NFOut[]`
```json
[
  {
    "id": "nf1",
    "numero": "NF-2024-001",
    "fornecedor": "Fornecedor X",
    "destinatario": "Cliente Alpha",
    "endereco": "Rua das Flores, 123 - Sao Paulo/SP",
    "status": "pendente",
    "motorista_id": "u4",
    "motorista": { "id": "u4", "nome": "Joao Silva", "email": "joao@log.com", "perfil": "motorista", "ativo": true },
    "created_at": "2026-10-22T12:00:00",
    "itens": [
      {
        "id": "i1",
        "product_id": "p1",
        "qtd_nota": 12,
        "qtd_embalagem": 6,
        "caixas_necessarias": 2,
        "caixas_lidas": 0,
        "conferido": false,
        "produto": { "id": "p1", "codigo": "21", "...": "..." }
      }
    ]
  }
]
```

### GET `/conference/nf/{nf_id}`
Qualquer autenticado. **404** "Nota Fiscal nao encontrada".

### POST `/conference/nf/{nf_id}/start`
**Permissao:** `admin`, `supervisor`, `operador`. Sem body.

Move a NF de `pendente` para `em_conferencia`.

**Erros**
| Codigo | Detalhe |
|---|---|
| 404 | "Nota Fiscal nao encontrada" |
| 400 | "NF nao pode ser iniciada. Status atual: {status}" |

**Resposta 200** - `NFOut`.

### POST `/conference/nf/{nf_id}/scan`
**Permissao:** `admin`, `supervisor`, `operador`.

**Body**
```json
{ "codigo_barras": "7891234560021" }
```

**Resposta 200** - `NFOut` com os itens e `caixas_lidas` atualizados.

**Erros**
| Codigo | Detalhe |
|---|---|
| 400 | "NF nao esta em conferencia" (status diferente de `em_conferencia`) |
| 422 | "Codigo de barras nao reconhecido" |
| 422 | "Produto nao pertence a esta NF" |
| 400 | "Item ja completamente conferido" |

### POST `/conference/nf/{nf_id}/assign`
**Permissao:** `admin`, `supervisor`.

**Body**
```json
{ "motorista_id": "u4" }
```

Atribui o motorista e move a NF para `em_entrega`.

**Erros**
| Codigo | Detalhe |
|---|---|
| 400 | "NF nao pode ser expedida. Status atual: {status}" (so `conferida` pode) |
| 404 | "Motorista nao encontrado" (usuario inexistente ou nao e motorista) |

**Resposta 200** - `NFOut`.

---

## Entrega

Prefixo `/delivery`. Baixa de entrega em campo.

### GET `/delivery/nf`
Qualquer autenticado. Retorna NFs com status `em_entrega`, `entregue` ou `reagendado`,
ordenadas por `created_at` desc. Para perfil `motorista`, apenas as NFs com
`motorista_id` proprio.

**Resposta 200** - `NFOut[]`

### POST `/delivery/nf/{nf_id}/deliver`
Qualquer autenticado (sem restricao de perfil - ver backlog P1-05).
`multipart/form-data`, campo **`foto`** (opcional).

**Resposta 200** - `DeliveryOut`
```json
{
  "id": "d1",
  "nf_id": "nf1",
  "motorista_id": "u4",
  "status": "entregue",
  "foto_canhoto_url": "/uploads/8f14e45f-ceea-467a-9d5d-e1a1b2c3d4e5.jpg",
  "motivo_falha": null,
  "data_reagendamento": null,
  "created_at": "2026-10-22T15:30:00"
}
```

**Erros**
| Codigo | Detalhe |
|---|---|
| 404 | "Nota Fiscal nao encontrada" |
| 400 | "NF nao esta em entrega" |
| 403 | "NF nao atribuida a voce" |

### POST `/delivery/nf/{nf_id}/reschedule`
Mesmas validacoes do endpoint anterior.

**Body**
```json
{ "motivo": "Cliente Ausente", "data_reagendamento": "2026-10-24" }
```

**Resposta 200** - `DeliveryOut` com `status = "reagendado"`.

---

## Admin

Prefixo `/admin`.

### GET `/admin/users`
**Permissao:** `admin`. Retorna `UserOut[]` ordenado por `nome`.

### POST `/admin/users`
**Permissao:** `admin`.

**Body**
```json
{ "nome": "Maria Souza", "email": "maria@log.com", "senha": "maria123", "perfil": "operador" }
```

**Resposta 200** - `UserOut` criado.

**Erros**
| Codigo | Detalhe |
|---|---|
| 400 | "Email ja cadastrado" |
| 400 | "Perfil invalido" (fora de admin/supervisor/operador/motorista) |

### PUT `/admin/users/{user_id}`
**Permissao:** `admin`. Atualiza apenas os campos enviados.

**Body** (todos opcionais)
```json
{ "nome": "...", "email": "...", "perfil": "operador", "ativo": false }
```

**Resposta 200** - `UserOut`.

**Erros:** 404 "Usuario nao encontrado"

> Nao altera a senha e **nao** valida o `perfil` enviado (backlog P1-07).

### GET `/admin/motoristas`
**Permissao:** `admin`, `supervisor`. Retorna `UserOut[]` dos usuarios **ativos** com
perfil `motorista`.

### GET `/admin/reports/deliveries`
**Permissao:** `admin`, `supervisor`.

**Query**
| Param | Tipo | Descricao |
|---|---|---|
| `motorista_id` | string (opcional) | Filtra por motorista |

**Resposta 200** - lista de objetos
```json
[
  {
    "id": "d1",
    "nf_numero": "NF-2024-001",
    "motorista": "Joao Silva",
    "status": "entregue",
    "motivo_falha": null,
    "data_reagendamento": null,
    "foto_canhoto_url": "/uploads/8f14e45f.jpg",
    "created_at": "2026-10-22T15:30:00"
  }
]
```

### GET `/admin/overview`
**Permissao:** `admin`, `supervisor`.

**Resposta 200**
```json
{
  "total_nfs": 3,
  "by_status": { "pendente": 2, "conferida": 1 },
  "total_usuarios": 5,
  "motoristas_ativos": 2
}
```

---

## Uploads

A API monta `/uploads` como `StaticFiles` servindo `UPLOAD_DIR`.

```
GET /uploads/<uuid4>.<ext>
```

O nginx do frontend repassa `/uploads/` para a API. Arquivos sao nomeados com `uuid4` +
extensao original. **Sem** validacao de tipo nem limite de tamanho (backlog P0-04, P0-05).

---

## Convencoes

- Prefixos por modulo: `/auth`, `/wms`, `/conference`, `/delivery`, `/admin`.
- O nginx remove o `/api` da URL (`proxy_pass http://logfull-api:8000/`); o Vite em dev
  faz o mesmo rewrite.
- Datas em ISO 8601 (UTC); formatacao `pt-BR` no frontend.
- Sem paginacao nos endpoints de listagem (backlog P2-04).
- Respostas de erro: `{"detail": "mensagem"}`.

## Links Relacionados

- [[brain/api-contracts]]
- [[brain/business-rules]]
- [[architecture/system-overview]]
