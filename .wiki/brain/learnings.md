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

---

## 2026-10-22 - Fase 0 (seguranca antes do deploy)

### O `CMD` do Dockerfile rodava o seed em todo boot
- `backend/Dockerfile` executava `python app/seed.py` antes do uvicorn. Em producao isso
  criaria usuarios com senha conhecida (`admin123`) e recriaria dados de exemplo.
- Corrigido com a trava `SEED_DEMO_DATA` (default `false`); o seed virou opcional e o
  override local e quem liga. Na fase 1 o `create_all` sai de vez.

### `content_type` do upload e declarado pelo cliente
- Validar so o `content_type` da falsa sensacao de seguranca. A extensao do arquivo agora
  e escolhida pelo tipo declarado e o conteudo e conferido pelos magic bytes (JPEG `FF D8
  FF`, PNG, WebP), com limite de 5 MB.

### Variavel de ambiente obrigatoria precisa falhar no compose, nao na API
- `${VAR:?mensagem}` faz o `docker compose config` abortar antes de subir qualquer
  container. Sem isso a API sobe, o banco cai e o erro aparece longe da causa.
- `SECRET_KEY` tambem exige `min_length=32`: string vazia passaria na validacao de tipo e
  produziria tokens assinados com chave vazia.

### Portas publicadas quebram o Coolify
- `ports:` no compose base colide com o Traefik (`port is already allocated`). O padrao e
  `expose:` no base e `docker-compose.override.yml` para o ambiente local.

---

## 2026-10-22 - Fase 1 (Alembic e schema)

### `drop_table` nao apaga os tipos ENUM do Postgres
- O `downgrade` gerado pelo `autogenerate` derrubava as tabelas e deixava
  `perfil_enum`, `nf_status_enum` e `delivery_status_enum` no banco. O `upgrade head`
  seguinte falhava com `type ... already exists`.
- Solucao: `sa.Enum(name=tipo).drop(op.get_bind(), checkfirst=True)` no fim do
  `downgrade`. O ciclo `downgrade base` -> `upgrade head` precisa ser testado antes de
  confiar na migracao.

### Erro de serializacao acontece **depois** do commit
- Ao tornar `codigo_barras_master` e `localizacao` nulos, o `ProductOut` continuou
  exigindo `str`. A resposta de `/conference/nf/nf2/scan` deu 500 por
  `ResponseValidationError` — mas o `db.commit()` ja tinha rodado, entao a caixa foi
  contada mesmo com a resposta de erro.
- Licao: todo campo que passa a aceitar `NULL` no banco precisa virar `Optional` no schema
  de resposta no mesmo commit, senao o erro aparece como 500 e o dado ja foi gravado.

### `autogenerate` precisa de banco vazio para gerar a migracao inicial
- Rodar contra um banco ja criado por `create_all` produz um diff de ALTER, nao o schema
  completo. A migracao inicial foi gerada com o banco vazio (`down -v` antes), e conferida
  com um segundo `autogenerate` sem nenhuma alteracao detectada.

### Arquivo gerado dentro do container nao volta para o host
- `docker compose run` grava no filesystem do container descartavel. Para o arquivo de
  migracao aparecer no host: `-v "$PWD/backend:/app"`. E o arquivo sai como root: ajustar
  o dono depois.

### Coluna `unique` global anulava a chave composta
- `notas_fiscais.numero` era unico isoladamente. A chave composta
  `(cnpj_fornecedor, serie, numero)` nao serviria para nada enquanto o `unique` global
  existisse: o segundo fornecedor com NF 1234 seria rejeitado. O `unique` saiu.

### `@tanstack/react-query` declarado e nao usado
- Nao ha `QueryClientProvider` nem `useQuery`/`useMutation` em lugar nenhum. Todo o
  fetching e `useState` + `useEffect` + axios, com codigo de loading repetido em 5 telas.
