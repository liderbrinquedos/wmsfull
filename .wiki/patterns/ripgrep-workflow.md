# Pattern: Ripgrep Workflow

> **Categoria:** developer-tooling
> **Complexidade:** baixa
> **Ultima revisao:** 2026-05-12

## Quando Usar

Use ripgrep (rg) para todas as buscas no projeto ao inves de grep ou find.

## Comandos Essenciais

### Busca basica
```bash
rg "termo"                    # busca recursiva
rg "termo" ./src              # busca em diretorio especifico
rg -i "termo"                 # case-insensitive
```

### Busca por tipo de arquivo
```bash
rg -tpy "def "               # apenas Python
rg -tjs "const "             # apenas JavaScript
rg -tmd "## "                 # apenas Markdown
rg -tts "interface "          # apenas TypeScript
```

### Busca com contexto
```bash
rg -C3 "funcao"              # 3 linhas antes e depois
rg -B2 "return"               # 2 linhas antes
rg -A2 "return"               # 2 linhas depois
```

### Buscas Avancadas
```bash
rg -l "termo"                # apenas nomes de arquivos
rg -c "termo"                # contar ocorrencias por arquivo
rg -w "word"                 # palavra completa
rg -v "termo"                # inverter (linhas SEM termo)
```

## Ignorar Diretorios

O ripgrep ja ignora por padrao:
- `.git/`, `node_modules/`, `__pycache__/`
- Arquivos em `.gitignore`

Para ignorar dirs customizados, use `.ripgreprc`:
```
--ignore=vendor/
--ignore=dist/
--ignore=.venv/
```

## Aliases Recomendados ( ~/.bash_aliases )

```bash
alias rg='rg --color=auto'
alias rgc='rg -C3'            # com contexto
alias rgpy='rg -tpy'          # python
alias rgjs='rg -tjs'          # javascript
alias rgmd='rg -tmd'          # markdown
alias rgl='rg -l'            # listar arquivos
```

## Anti-Patterns (O que EVITAR)

- Nao use `find . -name` quando `rg` resolve
- Nao use `grep -r` quando `rg` e mais rapido
- Nao grave resultados em arquivo temporario desnecessariamente

## Links Relacionados

- [Documentacao ripgrep](https://github.com/BurntSushi/ripgrep)
- [[patterns/coding-standards]]
