# Pattern: Coding Standards - WMSFull

> **Categoria:** coding-standards
> **Complexidade:** baixa
> **Ultima revisao:** 2026-10-22

Padroes de codigo em vigor no WMSFull. Deviacao em codigo novo deve ser justificada em ADR.

---

## Quando Usar

Em toda escrita de codigo no backend (`backend/app/`) ou no frontend (`frontend/src/`).

---

## Backend (Python 3.12)

### Estrutura de camadas

```
routers/   -> HTTP: parse, permissao, status code, resposta
models/    -> estrutura do banco (SQLAlchemy 2.0 Declarative)
schemas/   -> contrato de entrada/saida (Pydantic v2)
core/      -> config, engine, seguranca
```

- **Regra:** a logica de negocio mora no router **ou** em `crud/` - nunca nos dois.
  Hoje `app/crud/` esta vazio e todas as queries estao inline nos routers
  (ver backlog P2-01).
- Queries usam a API `Query` legada (`db.query(Model).filter(...)`). A migracao para
  `select()` do SQLAlchemy 2.0 esta pendente; nao misturar os dois estilos.

### Models

```python
class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo = Column(String, nullable=False, unique=True, index=True)
    estoque_caixas = Column(Integer, default=0)
```

- `id` e **sempre** `String` com `default=lambda: str(uuid.uuid4())`.
- `nullable=False` em tudo que e obrigatorio.
- `unique=True, index=True` em chaves naturais (`users.email`, `products.codigo`,
  `products.codigo_barras_master`, `notas_fiscais.numero`).
- Enums do dominio usam `Enum(..., name="...")` com **nome nativo** do PostgreSQL:
  `perfil_enum`, `nf_status_enum`, `delivery_status_enum`.
- Datas: `default=datetime.utcnow` (depreciado - ver backlog P1-09; usar
  `datetime.now(timezone.utc)` em codigo novo).

### Schemas (Pydantic v2)

- Um unico arquivo: `app/schemas/schemas.py`.
- Padrao: `*Out` para leitura, `*Create`/`*Update` para escrita, `*Request` para bodies
  de acao.
- `ConfigDict(from_attributes=True)` em todo schema de saida de model.
- `model_config` e `class Config` estao depreciados no Pydantic v2 - use `model_config`.

### Routers

```python
router = APIRouter(prefix="/wms", tags=["WMS"])

@router.get("/products", response_model=list[ProductOut])
def list_products(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ...
```

- Prefixo no router, caminho **relativo** no decorator.
- `response_model` sempre declarado, exceto em endpoints de relatorio (retornam `dict`).
- Permissao em `Depends`: `get_current_user` para leitura autenticada,
  `require_roles("admin", "supervisor")` para escrita restrita.
- Handlers **sincronos** (`def`), nao `async def`, porque o driver e sincrono
  (`psycopg2`). So o upload de arquivo usa `await foto.read()`.
- Erros: `HTTPException(status_code=..., detail="mensagem em portugues")`.
  Codigos usados: 400 (regra de negocio), 401 (token), 403 (perfil), 404 (nao existe),
  422 (body invalido - ex.: codigo de barras nao reconhecido).

### Seguranca

- Senha: `get_password_hash` / `verify_password` (bcrypt, truncada em 72 bytes).
  **Nunca**Md5, SHA ou texto puro.
- Token: `create_access_token({"sub": user.id, "perfil": user.perfil})`.
- `get_current_user` deve checar `user.ativo` alem do token.

### Configuracao

- Toda variavel de ambiente em `app/core/config.py` via `pydantic-settings`.
- Defaults **nao** devem conter segredo real (hoje `SECRET_KEY` tem - backlog P0-01).
- `.env` e lido por `env_file = ".env"`, mas **nao** e versionado.

---

## Frontend (TypeScript 5 + React 18)

### Camadas

```
api/client.ts   -> unica fonte de chamadas HTTP (axios)
store/          -> Zustand (estado global: apenas auth hoje)
auth/           -> LoginPage + AuthGuard (RBAC de rota)
modules/<mod>/  -> telas + componentes do modulo
components/     -> Layout, Navbar (compartilhados)
```

- **Regra de ouro:** nenhuma tela chama `axios` direto. Sempre via `src/api/client.ts`.
- **Regra de ouro:** nenhuma tela cria o proprio `axios.create()`. A instancia e unica.

### API client

```ts
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

- Funcoes agrupadas por namespace: `authApi`, `wmsApi`, `conferenceApi`, `deliveryApi`,
  `adminApi`.
- Tipos de entidade exportados do mesmo arquivo (`User`, `Product`, `NFItem`,
  `NotaFiscal`, `DeliveryReportItem`, `AdminOverview`).
- `baseURL` e `/api` (relativo). O nginx remove o prefixo; o Vite em dev faz o mesmo
  rewrite. **Nunca** usar URL absoluta no frontend.

### Estado

- Zustand com persistencia **manual** em `localStorage` (o middleware `persist` nao e
  usado).
- Chaves: `token` e `user`.
- `JSON.parse` do `localStorage` sempre dentro de `try/catch` (backlog P2-12).
- `init()` revalida a sessao via `GET /auth/me` no boot do `App`.

### Componentes

- Tipos de componente: `React.FC<Props>` (padrao do projeto).
- Estilo: **CSS puro** com classes de `index.css` + inline styles para o especifico.
  Nao ha Tailwind, CSS-in-JS nem CSS Modules no projeto.
- Emojis sao o padrao para icones (com SVG inline apenas na logo).
- Breakpoint unico: **768px**. `.desktop-only` e `.mobile-only` sao os utilitarios.
- Modais usam a estrutura `.modal-overlay` > `.modal-content` (repetida em cada modulo
  por ausencia de componente compartilhado - backlog P3-02).

### Fetching

- Padrao atual: `useState` + `useEffect` + `await api.get(...)` com flags de
  `loading`/`error` locais.
- Debounce de 250 ms na busca de produtos.
- `Promise.all` para carregamentos paralelos (produtos + stats).
- **Trate o erro**: hoje varias telas so fazem `console.error` (backlog P3-01).

### Rotas

- Toda rota protegida fica dentro de `<Route element={<Layout />}>`.
- Guarda: `<AuthGuard allowedRoles={['admin','supervisor']} />`.
- `getHomeRedirect()` decide a home por perfil.

---

## Git

- Conventional Commits **em portugues**: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
  Escopo opcional: `fix(wms): ...`.
- Branch principal: `main`.
- Nao commitar: `.env`, `node_modules/`, `dist/`, `__pycache__/`, `uploads/`, `.leankg/`.

---

## Anti-Patterns (o que EVITAR)

- Criar um novo `axios.create()` em um modulo.
- Hardcodar URL de API no frontend.
- Colocar `SECRET_KEY` ou senha real no codigo, no compose ou no `.env.example`.
- Usar `datetime.utcnow` em codigo novo (use `datetime.now(timezone.utc)`).
- Pular a camada `schemas` e devolver modelos SQLAlchemy direto.
- Criar tabela nova sem atualizar `app/models/__init__.py` (o re-export e o que registra
  a tabela no `Base.metadata`).
- Usar `AsyncSession` com `psycopg2` (o driver e sincrono).
- Duplicar `.modal-overlay` mais uma vez sem antes extrair um componente.

---

## Exemplo no Projeto

- `backend/app/routers/conference.py` - transicoes de status e validacao de bipagem
- `backend/app/core/security.py` - `get_current_user` e `require_roles`
- `frontend/src/api/client.ts` - instancia axios, interceptors e namespaces
- `frontend/src/store/authStore.ts` - persistencia manual da sessao
- `frontend/src/modules/conference/ConferenceSession.tsx` - refocus automatico do input
  de codigo de barras (padrao para leitor USB)

## Links Relacionados

- [[patterns/frontend-standards]]
- [[patterns/ripgrep-workflow]]
- [[integrations/api-catalog]]
