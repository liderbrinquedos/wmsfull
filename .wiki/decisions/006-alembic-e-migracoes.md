# ADR-006: Alembic e migracoes versionadas

> **Data:** 2026-10-22
> **Status:** accepted — implementado em 2026-10-22
> **Autor:** liderbrinquedos
> **Substitui parcialmente:** [[decisions/003-schema-criado-por-seed-sem-alembic]]

## Contexto

O schema do WMSFull nasce de `Base.metadata.create_all(bind=engine)` dentro de
`backend/app/seed.py:38` (ADR-003). O diretorio `backend/alembic/` existe vazio, `alembic`
nao esta em `requirements.txt` e nenhuma migracao jamais foi escrita.

Essa escolha era aceitavel enquanto o banco continha apenas os 5 produtos e as 3 notas do
seed: mudar uma coluna custava `docker compose down -v`. Ela deixa de ser aceitavel com o
plano de producao aprovado em
`docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`, que exige:

- `products.ean13`, `products.ean14`, `products.ean13_origem`, `products.ean14_origem`,
  `products.atualizado_em`;
- `notas_fiscais.chave_nfe`, `serie`, `cliente`, `cnpj_cliente`, `data_emissao`,
  `atualizado_em`;
- tres tabelas de controle de ingestao (`sync_runs`, `sync_run_errors`, `sync_requests`);
- `products.qtd_embalagem` deixa de aceitar vazio (`NOT NULL default 1`).

Sao **treze** alteracoes de schema. Com `create_all`, a unica forma de aplica-las seria
recriar o volume `pgdata`. Depois do go-live, isso significa perder catalogo, notas,
conferencias e canhotos.

## Decisao

Adotar **Alembic** agora, antes de existir dado de producao, com quatro regras:

1. **`alembic init`** com `env.py` lendo `DATABASE_URL` de `app/core/config.py` (nenhuma
   URL duplicada no `alembic.ini`).
2. **Uma migracao inicial** gerada por `autogenerate` ja refletindo o schema final. Nao ha
   base de producao a preservar, entao nao existe migracao "de baseline" separada.
3. **`seed.py` deixa de criar schema.** Passa a apenas inserir dados, condicionado a
   `SEED_DEMO_DATA=true` (default `false` em producao).
4. **Container one-shot `migrate`** no compose: roda `alembic upgrade head` e termina com
   codigo 0. A `api` depende dele com
   `depends_on: migrate: condition: service_completed_successfully`.

Consequencia direta: `Base.metadata.create_all` sai do projeto. Quem cria schema e o
Alembic; quem popula demonstracao e o seed.

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| Manter `create_all` (ADR-003) | zero trabalho agora | 13 alteracoes exigiriam `down -v`; inaceitavel com dado real |
| `create_all` no `main.py` | API sempre cria o schema ao subir | continua sem `ALTER TABLE`; mascara falha de deploy |
| SQL manual versionado em `.sql` | sem dependencia nova | sem `downgrade`, sem historico, sem `autogenerate` |
| Alembic (decidido) | historico versionado, `upgrade`/`downgrade`, um comando no deploy | uma dependencia e dois arquivos de configuracao a mais |

## Implementacao (2026-10-22)

Feito exatamente como decidido, mais dois ajustes que apareceram no caminho:

| Arquivo | Papel |
|---|---|
| `backend/alembic.ini` | `script_location`, `prepend_sys_path`; **sem** `sqlalchemy.url` |
| `backend/alembic/env.py` | le `settings.DATABASE_URL` e usa `Base.metadata` como alvo |
| `backend/alembic/versions/20261022_37849d286475_schema_inicial.py` | schema completo em uma revisao |
| `backend/app/seed.py` | sem `create_all`; so dados, sob `SEED_DEMO_DATA` |
| `backend/Dockerfile` | `CMD` apenas `uvicorn`; o seed saiu do boot da API |
| `docker-compose.yml` | servico `logfull-migrate` (`alembic upgrade head && python app/seed.py`) |

Ajustes feitos na revisao da migracao gerada:

1. **`downgrade()` remove os tipos ENUM.** `op.drop_table` nao apaga
   `perfil_enum`, `nf_status_enum` e `delivery_status_enum`; sem o drop explicito, um
   novo `upgrade head` falha com `type ... already exists`. O ciclo
   `downgrade base` -> `upgrade head` foi testado.
2. **`notas_fiscais.numero` perdeu o `unique`.** A numeracao da NF e sequencial por
   serie, entao duas series podem ter a NF 1234: manter o `unique` global rejeitaria a
   segunda. Ficaram `chave_nfe` unica e `uq_nf_serie_numero`; `numero` continua indexado
   para busca.

3. **A nota e de saida, para cliente** (revisao `9f2c41b7a6d3`). A primeira versao do
   schema modelava a NF como compra de fornecedor (`fornecedor` + `destinatario` +
   unicidade por `cnpj_fornecedor`), o que nao corresponde ao fluxo: a empresa emite a
   nota e entrega ao cliente. `destinatario` virou `cliente`, `fornecedor` saiu e
   `cnpj_fornecedor` virou `cnpj_cliente`.

O `migrate` usa a mesma imagem da API e `restart: "no"`; a `api` depende dele com
`condition: service_completed_successfully`.

## Consequencias

- **Positivas:** mudanca de schema deixa de ser destrutiva; o deploy tem um passo explicito
  e verificavel (`alembic upgrade head`); o schema passa a ser derivado do codigo e nao de
  um efeito colateral do seed; `alembic current`/`history` respondem "em que versao este
  banco esta".
- **Impacto no codigo:** `backend/app/seed.py` perde o `create_all`; `requirements.txt`
  ganha `alembic`; `backend/alembic.ini` e `backend/alembic/env.py` passam a existir;
  `models/__init__.py` continua sendo o ponto que registra as tabelas no `Base.metadata`
  (necessario para o `autogenerate` enxergar tudo).
- **Impacto na equipe:** toda mudanca de modelo passa a exigir um comando
  (`alembic revision --autogenerate -m "..."`) e a revisao do arquivo gerado. `autogenerate`
  nao detecta renomeacao de coluna nem mudanca de tipo com perda de dado - a revisao manual
  continua obrigatoria.
- **Negativas:** mais um passo no boot (mitigado pelo container `migrate`);
  `SEED_DEMO_DATA` mal configurado em producao popularia dados falsos (mitigado pelo
  default `false`); ambientes de desenvolvimento existentes precisam de `down -v` **uma
  unica vez**, na transicao.
- **Provisoriedade:** esta ADR encerra a decisao da ADR-003. A ADR-003 permanece no
  historico como registro de por que o projeto nasceu sem migracao.

## Links Relacionados

- [[decisions/003-schema-criado-por-seed-sem-alembic]]
- [[architecture/system-overview]]
- [[brain/learnings]]
- `docs/superpowers/specs/2026-10-22-producao-e-fontes-de-dados-design.md`
- [Alembic](https://alembic.sqlalchemy.org/)
