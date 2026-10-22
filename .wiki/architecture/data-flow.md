# Data Flow - WMSFull

> **Ultima revisao:** 2026-10-22

Fluxos de dados dos 4 processos operacionais: login, WMS, conferencia e entrega.

---

## 1. Login e Sessao

```
[LoginPage]
   │ email + senha
   ▼
authStore.login()  ──▶ authApi.login()  ──▶ POST /auth/login
   │                                          │
   │                          ┌───────────────┴────────────────┐
   │                          │ busca User por email            │
   │                          │ verifica bcrypt                 │
   │                          │ checa user.ativo                │
   │                          │ gera JWT {sub, perfil}          │
   │                          └───────────────┬────────────────┘
   │◀───── {access_token, token_type, user} ──┘
   │
   ├─▶ localStorage['token'] = access_token
   └─▶ localStorage['user']  = {id, nome, email, perfil, ativo}
   │
   ▼
redirectByRole(perfil):  motorista → /delivery
                         operador → /conference
                         demais  → /wms
```

**Revalidacao no boot**

```
[App] useEffect → authStore.init()
   │ lê localStorage['token']
   ├─ sem token → return (fica deslogado)
   └─ com token → GET /auth/me
        ├─ 200 → reescreve localStorage['user'], user = dados
        └─ 401 → limpa token e user do localStorage
```

**Interceptors do axios** (`src/api/client.ts`)
- Request: injeta `Authorization: Bearer <localStorage.token>` em toda chamada.
- Response 401: limpa `token`/`user` e faz `window.location.href = '/login'`.

---

## 2. WMS - Consultar e enderecar

```
[WMSPage]  useEffect → loadData()
   │
   ├─▶ GET /wms/products?search=...   ──▶  db.query(Product).filter(ILIKE)
   └─▶ GET /wms/stats                 ──▶  agregacao por rua + estoque_baixo
   │
   ▼
lista de ProductCard (grid, minmax 320px)
   │  cada card: codigo/referencia, descricao, LocationBadge,
   │              qtd_embalagem, estoque_caixas (laranja se < 5)
   │
   │  [Alterar Localizacao]  (so admin/supervisor)
   ▼
[MoveLocationModal]
   │ Rua(1) + Prat(1) + Pos(2, padStart) + Nivel(1)
   │ estoque em caixas master
   ▼
PUT /wms/products/{id}/location  {localizacao, estoque_caixas}
   │
   ▼
atualiza o item na lista local + recarrega apenas /wms/stats
```

**Busca:** debounce de 250 ms no `useEffect` com dependencia `search`.

---

## 3. Conferencia - Bipagem

```
[ConferencePage]
   │ filtro por status (abas: Todas / Pendentes / Em Conferencia / Conferidas)
   ▼
GET /conference/nf?status=...
   │
   ▼
cards de NF (numero, fornecedor, destinatario, endereco, progresso, itens)
   │
   │  [Iniciar Conferencia]  (status = pendente)
   ▼
POST /conference/nf/{id}/start
   │  400 se o status nao for "pendente"
   ▼
[ConferenceSession]
   │
   │  input de codigo de barras com refocus automatico (leitor USB: digita + Enter)
   │  ou botao "Bipar Caixa (+1)" por item
   ▼
POST /conference/nf/{id}/scan  {codigo_barras}
   │
   ├─ resolve Product por codigo_barras_master      (422 se nao achou)
   ├─ localiza NFItem com mesmo nf_id + product_id  (422 se nao pertence)
   ├─ item.conferido? → 400
   ├─ caixas_lidas += 1
   ├─ caixas_lidas >= caixas_necessarias → item.conferido = true
   └─ todos os itens conferidos → nf.status = "conferida"
   │
   ▼
resposta: NFOut com os itens atualizados → barra de progresso + lista de itens
   │
   │  [Expedir para Entrega]  (admin/supervisor - ver backlog P1-04)
   ▼
POST /conference/nf/{id}/assign  {motorista_id}
   │  400 se a NF nao estiver "conferida"
   │  404 se o usuario nao existir ou nao for motorista
   ▼
nf.status = "em_entrega"; nf.motorista_id = <motorista>
```

---

## 4. Entrega - Baixa em campo

```
[DeliveryPage]
   │ GET /delivery/nf
   │   (backend ja filtra: em_entrega | entregue | reagendado)
   │   (motorista: somente nf.motorista_id == proprio id)
   ▼
KPI cards clicaveis: A Entregar / Entregues / Reagendadas (filtro client-side)
   │
   │  [Baixa na Entrega]
   ▼
[DeliveryModal]
   │
   ├─▶ "Entrega Concluida"
   │      ├─ [Tirar Foto com a Camera]  → <input capture="environment">
   │      │     └─ preview via FileReader.readAsDataURL
   │      └─ POST /delivery/nf/{id}/deliver   (multipart: campo "foto", opcional)
   │            ├─ 400 se status != "em_entrega"
   │            ├─ 403 se motorista e a NF nao for sua
   │            ├─ grava {uuid4}{ext} em UPLOAD_DIR
   │            ├─ Delivery(status="entregue", foto_canhoto_url="/uploads/<file>")
   │            └─ nf.status = "entregue"
   │
   └─▶ "Nao Entregue (Reagendar)"
          ├─ motivo (6 opcoes fixas) + data
          └─ POST /delivery/nf/{id}/reschedule  {motivo, data_reagendamento}
                ├─ Delivery(status="reagendado", motivo_falha, data_reagendamento)
                └─ nf.status = "reagendado"
   │
   ▼
[AdminDashboard - Historico de Entregas]
   GET /admin/reports/deliveries?motorista_id=...
   └─ miniaturas de foto_canhoto_url (proxy /uploads)
```

---

## 5. Gestao de Usuarios

```
[AdminDashboard - aba Usuarios]  (so admin)
   │
   ├─▶ GET  /admin/users          → lista com badge de perfil e Ativo/Inativo
   ├─▶ POST /admin/users          {nome, email, senha, perfil}
   │      400 se email duplicado | 400 se perfil invalido
   └─▶ PUT  /admin/users/{id}     {ativo: !ativo}
          → desativa (nao apaga): o usuario inativo nao loga mais
```

---

## 6. Onde os dados entram hoje

```
[docker compose up]
   └─▶ logfull-api: CMD "python app/seed.py && uvicorn ..."
         ├─ wait_for_db()  (10 tentativas x 3 s)
         ├─ Base.metadata.create_all(engine)   ← cria as 5 tabelas e os 3 enums
         └─ popula (somente se users estiver vazio):
               5 usuarios, 5 produtos, 3 NFs, 6 itens
```

**Nao existe nenhuma outra entrada de dados.**
Nao ha importacao de `.xlsx`/`.csv`, nao ha integracao com ERP, nao ha cadastro manual de
produtos ou NFs pela API. Ver `[[integrations/data-sources]]`.

---

## 7. Persistencia e Uploads

| Dado | Onde vive | Como some |
|---|---|---|
| Usuarios, produtos, NFs, itens, entregas | PostgreSQL, volume `pgdata` | `docker compose down -v` (ou `pg_dump` para backup) |
| Fotos de canhoto | filesystem do container, volume `uploads` | idem |
| Token e usuario logado | `localStorage` do navegador | logout ou limpeza de dados do navegador |
| Shell do PWA (assets) | cache do service worker (Workbox) | `--atualizacao do service worker` |
| Dados de API | **nenhum cache** | - (sem `runtimeCaching`, sem IndexedDB) |

---

## 8. Caminhos que hoje nao fecham

| Ponto | Consequencia |
|---|---|
| Sem `runtimeCaching` nem IndexedDB | qualquer operacao offline se perde |
| Sem debito de estoque | `estoque_caixas` nao muda na bipagem nem na entrega |
| Sem lock de nota | dois operadores podem bipar a mesma NF |
| Sem `usuario_id` em `nf_itens` | nao se sabe quem conferiu |
| `GET /admin/motoristas` exige `admin|supervisor` | `operador` nao consegue expedir (P1-04) |
| `require_roles` ausente em `/delivery/*` | qualquer perfil pode dar baixa (P1-05) |
| `create_all` fora da API | API sobe sem tabelas se o seed nao rodar (P1-03) |
