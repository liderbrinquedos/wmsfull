# ADR-003: Schema criado pelo seed, sem Alembic

> **Data:** 2026-10-22
> **Status:** accepted
> **Autor:** liderbrinquedos

## Contexto

O projeto nasceu como um prototipo funcional: o objetivo era ter o ciclo
WMS -> Conferencia -> Entrega rodando ponta a ponta, com o minimo decerimonia de
infraestrutura.

O diretorio `backend/alembic/` existe, mas esta **vazio**: nao ha `alembic.ini`, nem
`env.py`, nem `versions/`, e `alembic` nem consta em `requirements.txt`. Nenhuma mencao a
alembic existe no codigo.

O schema e criado pelo `backend/app/seed.py:38`, que chama
`Base.metadata.create_all(bind=engine)` antes de popular os dados de exemplo. O `CMD` do
container executa `python app/seed.py && uvicorn app.main:app`, entao o seed sempre
precede a API.

Consequencias conhecidas dessa escolha:

- `create_all` **nunca** faz `ALTER TABLE`. Mudar uma coluna em `models/` nao tem efeito
  em um banco ja seedado.
- Para aplicar uma mudanca de schema hoje seria preciso **recriar o volume `pgdata`**,
  o que significa perder todos os dados.
- `app/main.py` nao importa `Base` nem os models: subir a API fora do Docker sem rodar o
  seed antes quebra em runtime com `relation "users" does not exist`.
- O seed e idempotente (se `users` tiver registros, nao insere nada), entao ele nao serve
  como mecanismo de migracao.

## Decisao

**Manter o schema gerado pelo seed como estado atual**, e tratar a introducao do Alembic
como um item de backlog de producao (P1-02), a ser decidido junto com o deploy - quando
havera dados reais para perder.

Mientras isso:

- `backend/app/seed.py` continua sendo o unico ponto de criacao do schema, e o CMD do
  container mantem a ordem `seed && uvicorn`.
- Mudancas de schema exigem `docker compose down -v` (recriacao do volume) em ambiente de
  desenvolvimento.
- A documentacao do projeto registra explicitamente essa limitacao (README, `system-overview`
  e `learnings`) para que ninguem perda dados por desconhecimento.

## Alternativas Consideradas

| Alternativa | Pros | Contras |
|---|---|---|
| Alembic desde o inicio | Migracoes versionadas; `upgrade`/`downgrade` | Overhead inicial; exige `alembic.ini`, `env.py`, versao inicial e `alembic` nas dependencias |
| `create_all` no `main.py` | API sempre cria o schema ao subir | Esconde o problema; continua sem migrar; mascara erro de deploy |
| SQLAlchemy `metadata.create_all` + edicao manual de schema | Sem ferramenta nova | Pior caso: mudanca de coluna silenciosamente ignorada |
| Manter como esta (decidido) | Zero retrabalho agora; funcional para o estagio atual | Mudanca de schema destrutiva ate o Alembic entrar |

## Consequencias

- **Positivas:** zero dependencia a mais; o boot e deterministico e auto-suficiente; o
  prototipo sobe em um comando.
- **Impacto no codigo:** `app/crud/` vazio e `app/main.py` sem import de `Base` sao
  consequencias diretas; toda mudanca futura de `models/` precisa de um plano de dados.
- **Impacto na equipe:** o time precisa saber que **nao existe migracao**; antes de ir
  para producao, isso precisa ser resolvido (a checklist de deploy em
  `backlog/tech-debt.md` marca como P1).
- **Negativas:** risco de perda de dados em qualquer mudanca de schema; ambiente de
  producao exigira um procedimento destrutivo, o que e inaceitavel.

## Nota de Evolucao

Esta ADR e explicitamente **provisoria**. A proxima decisao sobre o tema deve ser
registrada como ADR-006 (ou superior) e responder:

1. Alembic com `upgrade` automatico no boot ou container one-shot no deploy?
2. Como fazer o `seed` deixar de ser o responsavel pelo schema?
3. Qual o procedimento de `downgrade`?

## Links Relacionados

- [[brain/learnings]]
- [[architecture/system-overview]]
- [[architecture/data-flow]]
- [Alembic](https://alembic.sqlalchemy.org/)
