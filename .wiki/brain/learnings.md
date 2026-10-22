# Learnings - WMSFull

> **Ultima revisao:** 2026-10-22
> Registro de erros, descobertas e aprendizados. Escreva aqui quando bater em algo
> inesperado - evita repetir a mesma investigacao.

---

## 2026-10-22 - Mapeamento inicial do projeto

### O schema do banco nao e criado pela API
- **Sintoma:** `relation "users" does not exist` ao subir `uvicorn app.main:app` direto.
- **Causa:** `Base.metadata.create_all` so roda em `backend/app/seed.py:38`. O `main.py`
  nem importa `Base` nem os models.
- **Aprendizado:** no Docker o CMD e `python app/seed.py && uvicorn ...`, entao o seed
  sempre precede a API. Fora do Docker, rode o seed antes.

### `create_all` nao migra schema
- **Sintoma:** mudar uma coluna em `models/` nao tem efeito no banco existente.
- **Causa:** `create_all` so emite `CREATE TABLE` para o que ainda nao existe; nunca faz
  `ALTER TABLE`.
- **Aprendizado:** mudanca de schema exige recriar o volume `pgdata` (perde os dados) ou
  adotar Alembic. Ver `[[decisions/003-schema-criado-por-seed-sem-alembic]]`.

### `directorio/alembic/` vazio engana
- O diretorio `backend/alembic/` existe, mas esta **vazio**: sem `alembic.ini`, sem
  `env.py`, sem `versions/`, e `alembic` nem esta em `requirements.txt`.
- **Aprendizado:** um diretorio de migracao vazio e pior que nenhum - da a impressao
  errada de que existe migracao. Tratar como debito tecnico (backlog P1-02).

### `app/crud/` tambem esta vazio
- Nenhuma camada CRUD; todo o SQL esta inline nos routers, usando a API `Query` legada
  em vez de `select()` do SQLAlchemy 2.0.

### Pillow instalado e nunca importado
- `Pillow==10.3.0` esta em `requirements.txt:10`, mas nenhum `.py` importa `PIL`.
- A foto do canhoto e gravada byte a byte, sem compressao nem thumbnail.
- **Aprendizado:** o `logdriver` faz exatamente isso (thumbnail 1920px, JPEG q80) - da
  para copiar o padrao. Backlog P2-02.

### Operador nao consegue expedir NF
- `ConferenceSession` chama `adminApi.getMotoristas()` (exige `admin|supervisor`) e
  `POST /conference/nf/{id}/assign` (idem). O `ConferenceSession` e acessivel por
  `operador`. Resultado: 403 + unhandled promise rejection (nao ha `.catch()`).
- **Aprendizado:** o RBAC do backend e o `AuthGuard` do frontend estao em coerencia no
  nome das rotas, mas nao no de acao. Sempre validar a matriz endpoint x perfil nas duas
  pontas.

### Regras de upload do Nginx sao o gargalo real
- `client_max_body_size` nao configurado -> default **1 MB**. Foto de canhoto de celular
  passa facile de 1 MB e toma 413.
- O backend tambem nao limita tamanho, nao valida extensao nem content-type, e le o
  arquivo inteiro em memoria com `await foto.read()`.

### Service worker com cache de 1 ano
- A regra de estaticos do nginx casa `sw.js` e aplica `immutable`, o que impede o
  navegador de buscar a versao nova do service worker - quebrando o `autoUpdate` do PWA.

### `add_header` nao acumula entre `server` e `location`
- No Nginx, um `add_header` dentro de `location` **substitui** os do nivel `server`.
  Resultado: `X-Content-Type-Options`, `X-Frame-Options` e `Service-Worker-Allowed` nao
  chegam aos arquivos estaticos.

### Manifesto PWA duplicado e divergente
- `frontend/public/manifest.json` e o objeto inline em `vite.config.ts:11-23`. As duas
  versoes diferem (`orientation` so no inline).

### `datetime.utcnow` esta depreciado no Python 3.12
- Usado em `nota_fiscal.py:26`, `delivery.py:26` e `security.py:32`.

### Nomenclatura divergente
- Projeto `wmsfull`, mas containers, volume, banco e usuario do Postgres usam `logfull`.
  Heranca de outro projeto.

### Credenciais de teste no bundle
- `LoginPage.tsx` tem 4 botoes de login rapido com senha em texto puro, compilados no
  bundle de producao.

### `@tanstack/react-query` declarado e nao usado
- Nao ha `QueryClientProvider` nem `useQuery`/`useMutation` em lugar nenhum. Todo o
  fetching e `useState` + `useEffect` + axios, com codigo de loading repetido em 5 telas.
