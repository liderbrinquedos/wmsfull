# Glossary - WMSFull

> **Ultima revisao:** 2026-10-22

| Termo | Significado |
|---|---|
| **WMS** | Warehouse Management System - modulo de armazem: catalogo, localizacao e estoque |
| **NF** | Nota Fiscal de **saida**: a empresa emite e o cliente recebe. Unidade central do sistema; carrega o status do fluxo operacional |
| **Cliente** | Destinatario da NF. E o dono do endereco de entrega, nao um fornecedor |
| **Chave da NF-e** | 44 digitos que identificam a nota em todo o pais. E a chave natural do sync |
| **Serie** | Sequencia de numeracao da NF. `(empresa, serie, numero)` identifica a nota na SEFAZ |
| **NUNOTA** | Numero unico da nota dentro do Sankhya. E a chave que evita duplicidade no sync |
| **NUMNOTA** | Numero da nota na SEFAZ. Unico por empresa e serie |
| **CODEMP** | Codigo da empresa/filial no Sankhya. A mesma base atende mais de uma empresa |
| **Sankhya** | ERP da empresa. As notas vivem em `TGFCAB` e os itens em `TGFITE` |
| **Fornecedor** | Nao existe neste fluxo. O WMSFull trata expedicao para clientes; compras nao entram no sistema |
| **NFItem** | Item (produto + quantidade) dentro de uma nota fiscal |
| **Caixa master** | Embalagem padrao do produto. `qtd_embalagem` = unidades dentro de uma caixa |
| **Caixa necessaria** | `ceil(qtd_nota / qtd_embalagem)` - quantas caixas master a nota exige |
| **Caixa lida** | Quantidade de caixas master ja bipadas na conferencia |
| **Codigo de barras master** | Codigo EAN unico por produto, usado na bipagem |
| **Bipagem** | Ato de ler um codigo de barras para contar uma caixa master |
| **Localizacao** | Endereco fisico do estoque no formato `RUA + PRAT + POS(2) + NIVEL` (ex.: `F102C`) |
| **Rua** | Primeiro caractere da localizacao (1 letra). Agrupamento no dashboard do WMS |
| **Prateleira** | Segundo caractere da localizacao (1 digito) |
| **Posicao** | Terceiro e quarto caracteres (2 digitos) |
| **Nivel** | Quinto caractere da localizacao (1 letra) |
| **Conferencia** | Etapa de verificacao da carga: bipagem dos itens de uma NF contra o esperado |
| **Expedicao** | Ato de atribuir o motorista a uma NF conferida e libera-la para `em_entrega` |
| **Entrega** | Baixa em campo: canhoto fotografado ou reagendamento com motivo |
| **Canhoto** | Comprovante de entrega (foto). Guardada em `/uploads/` e referenciada por URL relativa |
| **Reagendamento** | Entrega nao concluida, com motivo e nova data |
| **Motorista** | Usuario com perfil `motorista`; responsavel pelas entregas atribuidas |
| **Operador** | Usuario com perfil `operador`; executa a bipagem |
| **Supervisor** | Usuario com perfil `supervisor`; edita estoque, expede NFs e ve relatorios |
| **Admin** | Usuario com perfil `admin`; acesso total, incluindo CRUD de usuarios |
| **Perfil** | Campo `perfil` do usuario (enum `perfil_enum`) que define as permissoes (RBAC) |
| **NF pendente** | NF recem-criada, aguardando inicio de conferencia |
| **NF em conferencia** | NF em processo de bipagem |
| **NF conferida** | Todos os itens bateram com a quantidade esperada |
| **NF em entrega** | NF expedida, com motorista atribuido |
| **NF entregue** | Baixa concluida com sucesso |
| **NF reagendada** | Entrega nao concluida, com nova data marcada |
| **Ativo** | Campo booleano do usuario; `false` bloqueia login e invalidacoes de token |
| **Seed** | `backend/app/seed.py` - cria o schema e popula os dados de exemplo (idempotente) |
| **PWA** | Progressive Web App - SPA instalavel, com service worker e manifest |
| **Service worker** | Script que faz precache do shell e serve a aplicacao offline |
| **Fila offline** | Mecanismo (ainda inexistente) para reenviar bipagens/entregas sem rede |
| **Enums nativos** | Tipos ENUM do PostgreSQL: `perfil_enum`, `nf_status_enum`, `delivery_status_enum` |
| **logfull** | Nome herdado de containers, volume, banco e usuario do Postgres (projeto: `wmsfull`) |
