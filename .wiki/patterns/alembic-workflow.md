# Pattern: migracoes com Alembic

> **Categoria:** banco-de-dados
> **Complexidade:** media
> **Ultima revisao:** 2026-10-22

## Quando Usar

Sempre que o schema mudar: coluna nova, tabela, indice, constraint. Nunca editar o banco
a mao e nunca confiar em `create_all` — ele cria tabela que falta, mas nao altera a que
existe.

## Como Implementar

1. Alterar o model em `backend/app/models/`.
2. Gerar a revisao (o `-v` e obrigatorio para o arquivo sair do container para o host):

```bash
docker compose run --rm -v "$PWD/backend:/app" logfull-migrate \
  alembic revision --autogenerate -m "adiciona ean14 em products"
```

3. **Ler o arquivo gerado.** O `autogenerate` compara models com o banco, e so isso. Ele
   nao sabe o que o `DROP` significa.
4. Ajustar o que ele nao faz sozinho:

```python
def downgrade() -> None:
    op.drop_table("products")
    # Tipos ENUM sobrevivem ao drop_table; sem isso o proximo upgrade falha.
    sa.Enum(name="perfil_enum").drop(op.get_bind(), checkfirst=True)
```

5. Aplicar e conferir:

```bash
docker compose run --rm logfull-migrate alembic upgrade head
docker compose run --rm logfull-migrate alembic current
```

6. Testar o caminho de volta em ambiente local:

```bash
docker compose run --rm logfull-migrate alembic downgrade -1
docker compose run --rm logfull-migrate alembic upgrade head
```

7. Rodar `autogenerate` de novo: se ele gerar uma revisao com corpo vazio, models e banco
   estao em sincronia.

## Regras

1. Uma revisao por mudanca logica. Nao juntar "adiciona coluna" com "cria tabela" de
   assuntos diferentes.
2. Nunca editar uma revisao que ja rodou em producao: criar outra.
3. Toda coluna que passa a aceitar `NULL` exige o schema Pydantic correspondente como
   `Optional` no mesmo commit, senao a resposta vira 500 — **depois** do commit no banco.
4. `down -v` so em desenvolvimento. Em producao, `alembic downgrade`, nunca volume apagado.
5. Migracao de dado (preencher coluna existente) vai na mesma revisao do schema, com
   `op.execute`, e precisa ser idempotente.
6. O container `logfull-migrate` roda `alembic upgrade head` no boot. Se a migracao falhar,
   a API nao sobe — e isso e proposital.

## Anti-Patterns (o que EVITAR)

- `Base.metadata.create_all` no boot da API (foi o padrao ate a ADR-006).
- Rodar `alembic revision --autogenerate` com o banco sujo de alteracoes manuais: o diff sai
  mentiroso.
- Commitar o arquivo gerado sem ler: `autogenerate` propoe `DROP COLUMN` para renomeacao.
- Deixar `sqlalchemy.url` no `alembic.ini`: duplica a configuracao e vaza senha no repo.

## Exemplo no Projeto

- `backend/alembic/env.py` - le `DATABASE_URL` de `app/core/config.py`
- `backend/alembic/versions/20261022_37849d286475_schema_inicial.py` - schema completo
- `docker-compose.yml` - servico `logfull-migrate` (one-shot)
- `backend/app/seed.py` - apenas dados, nunca schema

## Links Relacionados

- [[decisions/006-alembic-e-migracoes]]
- [[decisions/003-schema-criado-por-seed-sem-alembic]]
- [[brain/learnings]]
