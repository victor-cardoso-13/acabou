# Acabou! — lista de mercado do casal (instruções para o Claude)

App da fábrica `Mesa/Aplicativos/`. Regras gerais, padrão técnico e checklist OWASP estão em `../CLAUDE.md` (valem aqui). Falar com o Victor em português simples; no fim, dizer como testar no iPhone/iPad.
Site: https://victor-cardoso-13.github.io/acabou/ · repositório público `victor-cardoso-13/acabou`.

## A ideia
Catálogo do que a casa tem (não uma lista que se apaga). Ciclo: tem em casa → (um toque) falta → (no mercado) carrinho → terminar = tem em casa. Cada produto tem categoria da casa (tela Em casa) e corredor do mercado (tela Mercado). Tudo editável; só o catálogo inicial (`src/motor/catalogo.ts`) vem do código.
Referência visual aprovada: `referencia/mock.html` (+ `catalogo.js`, `prints/`). Fora do MVP: "pode estar acabando", quantidade/marca, vários mercados, avisos no celular, preços.

## Código
- `src/motor/`: regras puras, sem tela nem internet. `casa.ts` = toda ação devolve **escritas** (`{'itens.cafe.falta': true,…}`); `aplicar` muda a cópia local, `inverso` gera o Desfazer. `lerCasa` valida tudo que chega da nuvem.
- `src/ui/`: telas. `estado.ts` tem `fazer(escritas)` (único caminho até a nuvem). Todo texto/figurinha/id passa por `escapar()`.
- `src/nuvem/`: `conta.ts` (Auth) e `casas.ts` (Firestore, cache offline ligado). Carregados depois que a página abre.
- Modo teste sem login: `npm run dev` + `?demo` (memória, só em desenvolvimento).

## Nuvem
Coleção `casas/{casaId}`: UM documento (`membros`, `corredores`, `categorias`, `itens`, `noMercado`, `nomes`, `aprender`). Grava-se só o campo mexido (`updateDoc` com caminho). Nunca dar `await` na gravação no toque (offline não resolve). E-mails sempre minúsculos. Ids só `[A-Za-z0-9]`.
Regras: `../../Jogos/Computador/firestore.rules` (bloco `casas`). **Limite assumido:** o Firestore não olha dentro de cada produto; tamanho de nome/figurinha só o app corta (`LIMITES`, `lerCasa`); as regras limitam formato e quantidade (400 itens, 40 listas, 4 membros).
A pessoa cria a conta ANTES de ser adicionada. Toda mudança nas regras: avisar o Victor antes do deploy e rodar os testes abaixo.

## Testes
- `npm test` (motor), `npx tsc --noEmit -p .`
- Regras e nuvem no emulador (precisa Java 21: baixar Temurin 21 JRE; o Java 17 do Brasfoot não serve para o firebase-tools atual). Emulador com Auth 9199 e Firestore 8189 (como em `../../Jogos/Computador/testes-regras/LEIA-ME.md`), `npx vite --port 5199`, depois `node scripts/testar-regras.mjs` e `node scripts/testar-nuvem.mjs` (2 pessoas, tempo real, modo avião). Esperado: tudo OK.
- Prints: `node scripts/prints.mjs prints` (iPad, iPhone 440/390/deitado, 393×852 com área segura; todas as telas e janelas).

## Pendências
Ver `PROMPT-PROXIMA-SESSAO.md` (ignorado pelo git).
