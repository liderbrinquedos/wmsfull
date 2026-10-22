# API Contracts - WMSFull

> **Ultima revisao:** 2026-10-22
> Contratos de negocio em alto nivel. O catalogo HTTP completo (params, exemplos de
> resposta, codigos de erro) esta em `[[integrations/api-catalog]]`.

---

## Autenticacao

### `POST /auth/login`

**Request** (`application/x-www-form-urlencoded`):
```
username=admin@log.com&password=admin123
```

**Response 200**
```json
{
  "access_token": "eyJhbGci...",
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
| Codigo | Quando |
|---|---|
| 401 | Email inexistente ou senha invalida |
| 403 | Usuario inativo (`ativo = false`) |

**Contrato com o frontend:** `authApi.login()` monta o body com `URLSearchParams`
(`frontend/src/api/client.ts:92-106`). O `authStore` grava `access_token` em
`localStorage.token` e o objeto `user` em `localStorage.user`.

### `GET /auth/me`

**Response 200**: `UserOut` (o usuario do token).
**Erros**: 401 "Token invalido ou expirado" (token invalido, expirado ou usuario inativo).

**Contrato com o frontend:** `authStore.init()` chama este endpoint no boot do `App`
para revalidar a sessao; em falha, limpa `token` e `user` do `localStorage`.

---

## Operacao 1 - WMS (Armazem)

### `GET /wms/products?search=`

Lista produtos. `search` e opcional e casa por `ILIKE` em `codigo`, `referencia` ou
`descricao`. Ordenado por `localizacao`.

**Response 200**: `ProductOut[]`

### `PUT /wms/products/{id}/location`

**Body**
```json
{ "localizacao": "F102C", "estoque_caixas": 20 }
```
Ambos os campos sao opcionais; so os nao-nulos sao aplicados.

**Response 200**: `ProductOut` atualizado.
**Erros**: 404 "Produto nao encontrado", 403 (perfil nao autorizado).

**Contrato com o frontend:** `MoveLocationModal` monta a localizacao concatenando
`RUA + PRAT + POS.padStart(2,'0') + NIVEL` e envia junto do estoque.

### `GET /wms/stats`

**Response 200**
```json
{
  "total_produtos": 5,
  "total_caixas": 85,
  "estoque_baixo": ["p3"],
  "por_rua": { "A": 1, "B": 1, "C": 1, "D": 1, "F": 1 }
}
```

---

## Operacao 2 - Conferencia

### `POST /conference/nf/{id}/start`

Sem body. Move a NF de `pendente` para `em_conferencia`.
**Erros**: 404, 400 "NF nao pode ser iniciada. Status atual: {status}".

### `POST /conference/nf/{id}/scan`

**Body**
```json
{ "codigo_barras": "7891234560021" }
```

**Response 200**: `NFOut` com os itens e o novo `caixas_lidas`.
**Erros**
| Codigo | Quando |
|---|---|
| 400 | NF nao esta em `em_conferencia` |
| 422 | Codigo de barras nao reconhecido |
| 422 | Produto nao pertence a esta NF |
| 400 | Item ja completamente conferido |

**Contrato com o frontend:** `ConferenceSession` mantem o foco automatico no input (leitor
USB digita + Enter) e refaz o foco a cada resposta.

### `POST /conference/nf/{id}/assign`

**Body**
```json
{ "motorista_id": "u4" }
```

**Response 200**: `NFOut` com `status = "em_entrega"` e `motorista_id` preenchido.
**Erros**: 400 (NF nao conferida), 404 "Motorista nao encontrado".

**Contrato com o frontend:** `adminApi.getMotoristas()` popula o `<select>`. Esse endpoint
exige `admin|supervisor`, e o `ConferenceSession` e acessivel por `operador` - geram 403
para o operador (backlog P1-04).

---

## Operacao 3 - Entrega

### `GET /delivery/nf`

**Response 200**: `NFOut[]` com status `em_entrega`, `entregue` ou `reagendado`.
Para `motorista`, somente as NFs com `motorista_id` proprio.

### `POST /delivery/nf/{id}/deliver`

**Request**: `multipart/form-data`, campo `foto` (opcional).
**Response 200**: `DeliveryOut`
```json
{
  "id": "...",
  "nf_id": "nf1",
  "motorista_id": "u4",
  "status": "entregue",
  "foto_canhoto_url": "/uploads/1f2e....jpg",
  "motivo_falha": null,
  "data_reagendamento": null,
  "created_at": "2026-10-22T12:00:00"
}
```
**Erros**: 404, 400 "NF nao esta em entrega", 403 "NF nao atribuida a voce".

**Contrato com o frontend:** `DeliveryModal` captura a foto com
`<input type="file" accept="image/*" capture="environment">` e mostra preview via
`FileReader.readAsDataURL`.

### `POST /delivery/nf/{id}/reschedule`

**Body**
```json
{ "motivo": "Cliente Ausente", "data_reagendamento": "2026-10-24" }
```

**Response 200**: `DeliveryOut` com `status = "reagendado"`.
**Erros**: 404, 400, 403.

---

## Gestao

### `GET /admin/overview`
```json
{ "total_nfs": 3, "by_status": { "pendente": 3 }, "total_usuarios": 5, "motoristas_ativos": 2 }
```

### `GET /admin/users` / `POST /admin/users` / `PUT /admin/users/{id}`
CRUD de usuarios (admin apenas). `POST` valida email duplicado e perfil; `PUT` atualiza
apenas campos enviados.

### `GET /admin/motoristas`
Usuarios **ativos** com perfil `motorista`.

### `GET /admin/reports/deliveries?motorista_id=`
Historico de entregas. Filtro opcional por motorista. Cada linha traz `nf_numero`,
`motorista`, `status`, `motivo_falha`, `data_reagendamento`, `foto_canhoto_url`, `created_at`.

---

## Health

| Endpoint | Response |
|---|---|
| `GET /` | `{"status":"ok","app":"WMSFull API","version":"1.0.0"}` |
| `GET /health` | `{"status":"healthy"}` |

---

## Convencoes da API

- Prefixos: `/auth`, `/wms`, `/conference`, `/delivery`, `/admin`.
- No nginx, `location /api/` faz `proxy_pass http://logfull-api:8000/` (remove o `/api`).
  O frontend chama `baseURL: '/api'`; em dev, o Vite faz o mesmo rewrite.
- Autenticacao: header `Authorization: Bearer <token>`.
- Datas: ISO 8601 em UTC no backend, `pt-BR` na exibicao.
- Sem paginacao em nenhum endpoint de listagem (ver backlog P2-04).
