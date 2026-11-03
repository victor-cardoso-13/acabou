/**
 * Configuração do Firebase do projeto "jogos-sem-anuncio" (o mesmo em TODOS os jogos:
 * copie este arquivo igual para cada jogo novo).
 * Não é senha: só diz qual é o projeto. Quem protege os dados são as regras em firestore.rules.
 *
 * Onde fica cada coisa no banco (jogos e apps usam o mesmo projeto):
 *   jogadores/{uid}/jogos/{jogo}    → progresso de cada jogo
 *   casas/{casaId}                  → a casa do Acabou! (lista de mercado do casal), ver src/nuvem/casas.ts
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBVcllIhxwtJ4Mt4FLKBhtG7Zdcy_TtTyw',
  authDomain: 'jogos-sem-anuncio.firebaseapp.com',
  projectId: 'jogos-sem-anuncio',
  storageBucket: 'jogos-sem-anuncio.firebasestorage.app',
  messagingSenderId: '65303229463',
  appId: '1:65303229463:web:da4440170be3b37107d852',
};
