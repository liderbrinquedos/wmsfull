# Current Focus: wmsfull

> **Atualizado em:** 2026-10-22

---

## Foco Atual

**Documentar, versionar e planejar a producao.**

| # | Frente | Estado | Proximo passo |
|---|---|---|---|
| 1 | Documentacao (`.wiki/`, `AGENTS.md`, `README.md`) | Concluido | - |
| 2 | Repositorio GitHub | Concluido | - |
| 3 | Brainstorm de producao + fontes de dados | **Em aberto** | Responder as perguntas do brainstorm |

---

## Em Aberto - Brainstorm de Producao

Decisoes que precisam ser tomadas (ver `[[projects/wmsfull]]` e `backlog/tech-debt.md`):

### Deploy
- [ ] Plataforma: Coolify (padrao da familia `logdriver`/`logstock`) ou outra?
- [ ] Migrar `docker-compose.yml` de `ports:` para `expose:` + `docker-compose.override.yml`?
- [ ] Dominio e HTTPS: qual FQDN para web e para a API?
- [ ] Postgres: mesma instancia Coolify ou servidor dedicado?
- [ ] Strategy de backup do banco?
- [ ] Ordem de boot: seed/migracao como container one-shot (`restart: "no"`)?

### Fontes de Dados
- [ ] Origem do catalogo de produtos: ERP via API, `.xlsx` (padrao do `logconf`) ou cadastro manual?
- [ ] Origem das notas fiscais e seus itens: idem?
- [ ] Cadastro de produtos/posicoes de estoque: tela admin ou importacao?
- [ ] Frequencia de atualizacao: tempo real, batch diario ou sob demanda?
- [ ] Quem e a fonte de verdade (ERP ou WMSFull) para a localizacao do estoque?

### Confiabilidade
- [ ] Fila offline de bipagens e entregas (PWA)?
- [ ] Compressao/thumbnail da foto do canhoto (Pillow ja esta instalado)?
- [ ] Limite de tamanho do upload (nginx esta em 1 MB)?

### Seguranca
- [ ] Remover credenciais de teste da tela de login?
- [ ] Rotacao de `SECRET_KEY` e validade do token?
- [ ] CORS restrito ao dominio de producao?

---

## Proximos Passos Sugeridos

1. Fechar o brainstorm e registrar as decisoes como ADRs 006+.
2. Transformar as ADRs em um backlog de implementacao priorizado.
3. Executar P0 (segredos, upload, compose) antes de qualquer deploy.
