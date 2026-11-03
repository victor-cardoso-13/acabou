/** Telas antes da casa: carregando, entrar/criar conta, "ainda não tem casa". */
import { escapar as e } from './seguranca.ts';

const app = () => document.getElementById('app')!;

export function mostrarCarregando(texto = 'Abrindo…'): void {
  app().innerHTML = `<div class="entrada"><h1>Acabou!</h1><p class="explica">${e(texto)}</p></div>`;
}

export interface AcoesLogin {
  entrar(email: string, senha: string): Promise<void>;
  criar(email: string, senha: string, nome: string): Promise<void>;
  esqueci(email: string): Promise<void>;
  mensagem(erro: unknown): string;
}

export function mostrarLogin(acoes: AcoesLogin, modoInicial: 'entrar' | 'criar' = 'entrar'): void {
  let modo = modoInicial;
  const desenhar = (aviso = '', ehErro = true) => {
    const criar = modo === 'criar';
    app().innerHTML = `<div class="entrada"><h1>Acabou!</h1>
      <p class="explica">${criar ? 'Crie a sua conta. Cada pessoa da casa tem a sua.' : 'Entre para ver a lista da casa.'}</p>
      <form id="fLogin">
        ${criar ? '<input class="campo" id="lNome" type="text" placeholder="Como quer ser chamado(a)?" maxlength="40" autocomplete="given-name" aria-label="Seu nome">' : ''}
        <input class="campo" id="lEmail" type="email" placeholder="E-mail" autocomplete="email" autocapitalize="none" aria-label="E-mail">
        <input class="campo" id="lSenha" type="password" placeholder="Senha" autocomplete="${criar ? 'new-password' : 'current-password'}" aria-label="Senha">
        <p class="erro" id="lErro" role="alert" style="${ehErro ? '' : 'color:var(--verde)'}">${e(aviso)}</p>
        <button class="ok" id="lOk">${criar ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <button class="troca" id="lTroca">${criar ? 'Já tenho conta' : 'Criar uma conta'}</button>
      ${criar ? '' : '<button class="troca" id="lEsqueci">Esqueci a senha</button>'}</div>`;
    const campo = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
    document.getElementById('lTroca')!.onclick = () => { modo = criar ? 'entrar' : 'criar'; desenhar(); };
    const esq = document.getElementById('lEsqueci');
    if (esq) esq.onclick = async () => {
      try { await acoes.esqueci(campo('lEmail')); desenhar('Enviamos um e-mail para você trocar a senha.', false); }
      catch (err) { desenhar(acoes.mensagem(err)); }
    };
    (document.getElementById('fLogin') as HTMLFormElement).onsubmit = async ev => {
      ev.preventDefault();
      const ok = document.getElementById('lOk') as HTMLButtonElement;
      ok.disabled = true;
      const email = campo('lEmail'), senha = campo('lSenha'), nome = campo('lNome');
      try {
        if (criar) await acoes.criar(email, senha, nome.trim() || email.split('@')[0] || 'Eu');
        else await acoes.entrar(email, senha);
      } catch (err) { desenhar(acoes.mensagem(err)); (document.getElementById('lEmail') as HTMLInputElement).value = email; }
    };
  };
  desenhar();
}

export function mostrarSemCasa(
  email: string, criar: () => Promise<void>, entrarComCodigo: (codigo: string) => Promise<void>, sair: () => void, erro: (e: unknown) => string,
): void {
  app().innerHTML = `<div class="entrada"><h1>Acabou!</h1>
    <div class="cartao"><b>Tenho um convite</b>
      <p class="explica">Quem criou a casa gera um convite em <b>Nossa casa</b> e manda o código para você. Entre com este e-mail: <b>${e(email)}</b>.</p>
      <input class="campo" id="cCodigo" type="text" placeholder="Código do convite" autocomplete="off" autocapitalize="characters" maxlength="14" aria-label="Código do convite">
      <p class="erro" id="cErroConvite" role="alert"></p>
      <button class="ok" id="cEntrar">Entrar na casa</button></div>
    <div class="cartao"><b>É a primeira vez de vocês?</b>
      <p class="explica">Crie a casa e depois convide quem mora com você.</p>
      <p class="erro" id="cErro" role="alert"></p>
      <button class="ok" id="cCriar">Criar a nossa casa</button></div>
    <button class="troca" id="cSair">Sair desta conta</button></div>`;
  document.getElementById('cSair')!.onclick = sair;
  const bt = document.getElementById('cCriar') as HTMLButtonElement;
  bt.onclick = async () => {
    bt.disabled = true; bt.textContent = 'Criando…';
    try { await criar(); } catch (err) {
      bt.disabled = false; bt.textContent = 'Criar a nossa casa';
      document.getElementById('cErro')!.textContent = erro(err);
    }
  };
  const be = document.getElementById('cEntrar') as HTMLButtonElement;
  be.onclick = async () => {
    const msg = document.getElementById('cErroConvite')!;
    msg.textContent = '';
    be.disabled = true; be.textContent = 'Entrando…';
    try { await entrarComCodigo((document.getElementById('cCodigo') as HTMLInputElement).value); } catch (err) {
      be.disabled = false; be.textContent = 'Entrar na casa';
      msg.textContent = erro(err);
    }
  };
}
