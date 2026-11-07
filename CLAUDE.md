# Acabou! — lista de mercado do casal (instruções para o Claude)

App da fábrica `Mesa/Aplicativos/`. Regras gerais, padrão técnico e checklist OWASP estão em `../CLAUDE.md` (valem aqui). Falar com o Victor em português simples; no fim, dizer como testar no iPhone/iPad.
Site: https://victor-cardoso-13.github.io/acabou/ · repositório público `victor-cardoso-13/acabou`.

## A ideia
Catálogo do que a casa tem (não uma lista que se apaga). Ciclo: tem em casa → (um toque) falta → (no mercado) carrinho → terminar = tem em casa. Cada produto tem categoria da casa (tela Em casa) e corredor do mercado (tela Mercado). Tudo editável; só o catálogo inicial (`src/motor/catalogo.ts`) vem do código.
Referência visual aprovada: `referencia/mock.html` (+ `catalogo.js`) e, da rodada 3, `referencia/mock-v2.html`. Fora do app (por enquanto): "pode estar acabando", quantidade na lista, avisos no celular, robô que busca preço sozinho, QR da nota fiscal, histórico/gráfico de preços.

## Vários mercados (rodada 3)
- A lista do que falta é UMA. O que muda por mercado é a **ordem dos corredores**. `casa.mercados` = mapa `id → {nome, ic, site, aprender, ordem, corredores[]}` (até 6; 40 corredores cada). Cada produto tem `cor: {<mercadoId>: <corredorId>}` (sem entrada = "Sem corredor" naquele mercado). Os preços NUNCA mudam a ordem nem os grupos da tela Mercado: só uma etiqueta e uma linha informativa no cartão escuro.
- `Alvo` (`{tipo:'categorias'} | {tipo:'corredores', mercado}`) diz onde mexer (renomear, mover, apagar…). O mercado escolhido fica só neste aparelho (`localStorage` `acabou.mercado`); durante as compras vale o de `noMercado.<uid> = {quando, mercado}` e não troca.
- **Migração** (`migracao()` em `casa.ts`): documento sem o campo `mercados` = formato de antes → vira o mercado `shibata` (corredores + `aprender` de antes; `cor` em texto vira `{shibata: …}`), numa gravação, escritas determinísticas. Só roda a partir de leitura confirmada pelo servidor (`!deCache && !pendente`), uma vez por abertura (`src/ui/nuvem.ts`). `lerCasa` lê os dois formatos (e um `cor` em texto regravado por aparelho velho); `corredores`/`aprender` soltos depois de migrar são ignorados.
- "Mercado novo" copia os corredores do mercado aberto (ids novos, cada produto no corredor equivalente) ou começa vazio. Nome de mercado sem `|` nem `:`. Site: vazio ou `https://…` até 100, nunca vira link (só entra no texto da pergunta).

## Preços (rodada 3)
- Documento SEPARADO `casas/{casaId}/dados/precos = { p: { <id>: {item, centavos, emb, marca, merc, quando, fonte, por} } }` (`src/motor/precos.ts`). Dinheiro em **centavos inteiros**. Gravação com `setDoc(..., {merge:true})` e `{p:{id: valor|deleteField()}}` (o documento nasce na 1ª anotação). Cache offline e `onSnapshot` como a casa.
- Cada gravação (`anotar()`) já inclui a limpeza: no máximo 3 anotações por produto e mercado, nada com mais de 90 dias, teto de 600 no documento. O Desfazer devolve também o que a limpeza apagou.
- **Comparação** (`comparar()`): por mercado vale a anotação mais nova (mesmo instante: a de id maior; os ids de `novoIdPreco` crescem com o tempo); só entram as de até 7 dias (dias de calendário) e só com preço de ≥ 2 mercados; compara por unidade na 1ª unidade que TODOS têm (kg, L, un), senão pelo preço cheio; **empate exato = ninguém é "mais barato"**. `lerMedidas`: "5 un ~400 g" = 5 un E 0,4 kg; "6 x 500 ml" = 3 L; dúzia = 12 un; "/kg".
- **Bloco ACABOU** (formato definido SÓ no app, `textoPergunta()` e `lerResposta()`): a pergunta pede, no fim da resposta, uma linha com `ACABOU` (aceita `**ACABOU**`, `# ACABOU`, `ACABOU:`) e uma linha por item: `item | Mercado: R$ preço (embalagem, marca) | …`, "não achei" quando não houver. A leitura normaliza apóstrofo curvo e acentos, acha o produto por nome (igual primeiro; "contém" só entre os itens da lista, o mais específico), separa embalagem e marca só por vírgula que NÃO vem antes de dígito ("1,3 kg"), ignora "sem marca", lê ≤ 20 mil caracteres e 200 linhas, linha repetida do mesmo produto e mercado: vale a última. Resposta real de teste: `tests/dados/resposta-real-claude.txt`.
- "Mandar para o Claude" chama `navigator.share` direto no toque (sem `await` antes); cancelar o menu não avisa nada; sem share/erro, copia e avisa. Cidade da casa (`cidade`, ≤ 60) entra na pergunta.
- Limites só do app (o Firestore não olha dentro de cada anotação): marca 40, embalagem 20, preço > 0 e < R$ 100.000. Regras: só membros da casa leem/gravam, só a chave `p`, ≤ 600 anotações.

## Código
- `src/motor/`: regras puras, sem tela nem internet. `casa.ts` = toda ação devolve **escritas** (`{'itens.cafe.falta': true,…}`); `aplicar` muda a cópia local, `inverso` gera o Desfazer. `lerCasa` valida tudo que chega da nuvem.
- `src/ui/`: telas. `estado.ts` tem `fazer(escritas)` (único caminho até a nuvem). Todo texto/figurinha/id passa por `escapar()`.
- `src/nuvem/`: `conta.ts` (Auth) e `casas.ts` (Firestore, cache offline ligado). Carregados depois que a página abre.
- Modo teste sem login: `npm run dev` + `?demo` (memória, só em desenvolvimento).

## Nuvem
Coleção `casas/{casaId}`: UM documento (`membros`, `mercados`, `categorias`, `itens`, `noMercado`, `nomes`, `cidade`; `corredores` e `aprender` só existem no formato de antes da rodada 3 e as regras ainda os aceitam, para aparelhos velhos). Grava-se só o campo mexido (`updateDoc` com caminho). Nunca dar `await` na gravação no toque (offline não resolve). E-mails sempre minúsculos. Ids só `[A-Za-z0-9]`.
Regras: `../../Jogos/Computador/firestore.rules` (bloco `casas`). **Limite assumido:** o Firestore não olha dentro de cada produto; tamanho de nome/figurinha só o app corta (`LIMITES`, `lerCasa`); as regras limitam formato e quantidade (400 itens, 40 categorias, 6 mercados, 4 membros, cidade ≤ 60).
**Entrada só por convite (2 travas):** um membro gera `convites/{código}` (`{casaId,email,por,criadoEm}`, código de 10 símbolos, vale 2 dias, uso único); a pessoa entra com o e-mail convidado E digita o código. `entrarPorConvite` = 1 gravação em lote (`casas/{id}/entradas/{uid}` + `membros` + apaga o convite). `membros` nunca é editado à mão (a regra recusa). Ninguém lista casas nem convites. A pessoa precisa ter conta antes (a dos jogos serve).
Toda mudança nas regras: avisar o Victor antes do deploy e rodar os testes abaixo.

## Testes
- `npm test` (motor), `npx tsc --noEmit -p .`
- Regras e nuvem no emulador (precisa Java 21: baixar Temurin 21 JRE; o Java 17 do Brasfoot não serve para o firebase-tools atual). Emulador com Auth 9199 e Firestore 8189 (como em `../../Jogos/Computador/testes-regras/LEIA-ME.md`), `npx vite --port 5199`, depois `node scripts/testar-regras.mjs` e `node scripts/testar-nuvem.mjs` (2 pessoas, tempo real, modo avião, mercados, preços e a migração de um documento no formato de antes; `DEPURAR=1` mostra a tela quando algo falha). Esperado: tudo OK. `scripts/verificar-aviso.mjs` confere o aviso acima das abas/do Terminar e o atalho de categoria.
- Prints: `node scripts/prints.mjs prints` (iPad, iPhone 440/390/deitado, 393×852 com área segura; todas as telas e janelas, inclusive mercados e preços).

## Pendências
Ver `PROMPT-PROXIMA-SESSAO.md` (ignorado pelo git).
