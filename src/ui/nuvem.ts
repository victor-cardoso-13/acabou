/** Liga o app à nuvem: conta, a casa ao vivo e a gravação. Só é carregado depois que a página abre. */
import { normalizarCodigo, registrarNome, casaInicial } from '../motor/casa.ts';
import { lerCasa } from '../motor/casa.ts';
import { casaSumiu } from './app.ts';
import { ligarSair } from './eventos.ts';
import { avisar, fazer, receberCasa, render, S, type Eu } from './estado.ts';
import { perguntarNome } from './folhas.ts';
import { mostrarCarregando, mostrarLogin, mostrarSemCasa } from './entrada.ts';

export async function iniciarNuvem(): Promise<void> {
  mostrarCarregando();
  let conta: typeof import('../nuvem/conta.ts');
  let casas: typeof import('../nuvem/casas.ts');
  try {
    [conta, casas] = await Promise.all([import('../nuvem/conta.ts'), import('../nuvem/casas.ts')]);
  } catch {
    mostrarCarregando('Não consegui abrir agora. Confira a internet e abra de novo.');
    return;
  }
  ligarSair(() => { void conta.sair(); });
  S.mensagemErro = conta.mensagemDeErro;
  S.guardarNome = conta.trocarNome;

  let parar: (() => void) | null = null;
  let nomeRegistrado = false;

  conta.observarConta(u => {
    parar?.(); parar = null;
    S.casa = null; S.repo = null; S.convidar = null; casaSumiu(); nomeRegistrado = false;
    if (!u) {
      S.eu = null;
      mostrarLogin({
        entrar: conta.entrar, criar: conta.criarConta, esqueci: conta.esqueciSenha, mensagem: conta.mensagemDeErro,
      });
      return;
    }
    const eu: Eu = { uid: u.uid, email: u.email, nome: u.nome };
    S.eu = eu;
    mostrarCarregando('Procurando a sua casa…');
    parar = casas.observarCasa(eu.email, c => {
      if (!c) {
        S.casa = null; S.repo = null; casaSumiu();
        const criar = async () => { await casas.criarCasa(casaInicial(eu.email, eu.uid, eu.nome)); };
        const entrar = async (texto: string) => {
          const codigo = normalizarCodigo(texto);
          if (!codigo) throw Object.assign(new Error('codigo'), { code: 'acabou/convite-invalido' });
          await casas.entrarPorConvite(codigo, eu.email, eu.uid); // a casa aparece sozinha (a busca ao vivo a encontra)
        };
        mostrarSemCasa(eu.email, criar, entrar, () => { void conta.sair(); }, conta.mensagemDeErro);
        return;
      }
      S.convidar = email => casas.criarConvite(c.id, email, eu.email);
      S.repo = { gravar: escritas => { casas.gravar(c.id, escritas).catch(err => avisar(conta.mensagemDeErro(err))); } };
      receberCasa(c.dados);
      if (!nomeRegistrado && S.casa) {
        nomeRegistrado = true;
        // nome: o da conta; senão o que já está salvo na casa; senão pergunta (nunca usa o começo do e-mail)
        const salvo = S.casa.nomes[eu.uid];
        if (!u.nome && salvo) S.eu = { ...eu, nome: salvo };
        if (!u.nome && !salvo) { S.eu = { ...eu, nome: '' }; perguntarNome(); }
        else { const e = registrarNome(lerCasa(c.dados), eu.uid, S.eu!.nome); if (Object.keys(e).length) fazer(e); }
      }
    }, err => {
      avisar(conta.mensagemDeErro(err));
    });
  });
}

/** Aviso quando a internet cai ou volta (o app continua funcionando pelo cache). */
export function vigiarInternet(): void {
  const mudou = (online: boolean) => {
    S.semInternet = !online;
    avisar(online ? 'Internet de volta. Tudo sincronizado.' : 'Sem internet. Pode continuar: as marcações sobem quando ela voltar.');
    if (S.casa) render();
  };
  window.addEventListener('offline', () => mudou(false));
  window.addEventListener('online', () => mudou(true));
  S.semInternet = !navigator.onLine;
}
