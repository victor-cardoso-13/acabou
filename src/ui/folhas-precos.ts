/** Janelas dos preços: anotar um preço, perguntar ao Claude, colar a resposta e a cidade. */
import { combina } from '../motor/busca.ts';
import { itensFaltando, listarItens, listarMercados, definirCidade } from '../motor/casa.ts';
import { anotar, lerResposta, lerValor, LIMITES_PRECO, novaAnotacao, novoIdPreco, reais, textoPergunta } from '../motor/precos.ts';
import { LIMITES } from '../motor/tipos.ts';
import { avisar, casa, fazer, fazerPrecos, mercadoAtual, meuNome, meuUid, S } from './estado.ts';
import { comprando } from './tela-mercado.ts';
import { fecharFolha, folha, textoSheet } from './folhas.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/* ---------- anotar um preço ---------- */
interface DadosPreco { item: string | null; busca: string; valor: string; emb: string; marca: string; merc: string | null }

/** `itemId` já escolhido (botão "+ preço" ou R$ do carrinho), ou null para escolher na janela. */
export function abrirPrecoSheet(itemId: string | null): void {
  // durante as compras, o mercado já vem preenchido
  precoSheet({ item: itemId, busca: '', valor: '', emb: '', marca: '', merc: comprando() ? mercadoAtual()?.id ?? null : null });
}

function precoSheet(d: DadosPreco): void {
  const c = casa();
  const i = d.item ? c.itens[d.item] : undefined;
  const mercados = listarMercados(c);
  folha(`<h2>Anotar preço</h2>
    ${i ? `<div class="troca"><span style="font-size:30px">${e(i.ic)}</span><label style="flex:1"><b>${e(i.nome)}</b></label><button class="link" id="fTrocaProd" style="color:var(--tinta-suave)">trocar</button></div>`
        : `<input class="campo" type="text" id="fProd" placeholder="Qual produto?" maxlength="${LIMITES.nome}" autocomplete="off" value="${e(d.busca)}" aria-label="Produto"><div class="chips" id="fAchados"></div>`}
    <div class="rot">Preço</div>
    <div class="campo-preco"><b>R$</b><input class="campo" type="text" id="fValor" inputmode="decimal" placeholder="0,00" maxlength="12" autocomplete="off" value="${e(d.valor)}" aria-label="Preço em reais"></div>
    <div class="rot">Embalagem (opcional)</div>
    <input class="campo" type="text" id="fEmb" placeholder="Ex.: 20 un, 1 kg, 500 g, 1 L" maxlength="${LIMITES_PRECO.emb}" autocomplete="off" value="${e(d.emb)}" aria-label="Embalagem">
    <div class="rot">Marca (opcional)</div>
    <input class="campo" type="text" id="fMarca" placeholder="Ex.: Pilão, Member's Mark" maxlength="${LIMITES_PRECO.marca}" autocomplete="off" value="${e(d.marca)}" aria-label="Marca">
    <div class="rot">Em qual mercado?</div>
    <div class="chips">${mercados.map(m => `<button class="chip ${m.id === d.merc ? 'sel' : ''}" data-fm="${e(m.id)}">${e(m.ic)} ${e(m.nome)}</button>`).join('')}</div>
    <div class="erro" id="fErro" role="alert"></div>
    <button class="ok" id="fSalvar">Salvar preço</button><button class="cancela" id="fCancela">Cancelar</button>`, () => {
    const pega = () => {
      d.valor = ($('fValor') as HTMLInputElement).value; d.emb = ($('fEmb') as HTMLInputElement).value; d.marca = ($('fMarca') as HTMLInputElement).value;
      const p = document.getElementById('fProd') as HTMLInputElement | null;
      if (p) d.busca = p.value;
    };
    $('fCancela').onclick = fecharFolha;
    const troca = document.getElementById('fTrocaProd');
    if (troca) troca.onclick = () => { pega(); d.item = null; d.busca = ''; precoSheet(d); };
    // a busca de produto só troca os botões (refazer a janela inteira fechava o teclado)
    const achar = () => {
      const alvo = $('fAchados');
      if (!alvo) return;
      const f = d.busca.trim();
      const achados = f ? listarItens(c).filter(x => combina(x.nome, f)).slice(0, 6) : [];
      alvo.innerHTML = achados.map(x => `<button class="chip" data-fprod="${e(x.id)}">${e(x.ic)} ${e(x.nome)}</button>`).join('');
      alvo.querySelectorAll<HTMLElement>('[data-fprod]').forEach(b => { b.onclick = () => { pega(); d.item = b.dataset.fprod!; precoSheet(d); }; });
    };
    const prod = document.getElementById('fProd') as HTMLInputElement | null;
    if (prod) { prod.oninput = () => { d.busca = prod.value; achar(); }; achar(); }
    document.querySelectorAll<HTMLElement>('[data-fm]').forEach(b => { b.onclick = () => { pega(); d.merc = b.dataset.fm!; precoSheet(d); }; });
    if (i && !d.valor) ($('fValor') as HTMLInputElement).focus();
    $('fSalvar').onclick = () => {
      pega();
      const erro = (t: string) => { $('fErro').textContent = t; };
      const centavos = lerValor(d.valor);
      if (!d.item || !casa().itens[d.item]) return erro('Escolha o produto.');
      if (!centavos) return erro('Escreva o preço. Ex.: 8,99');
      if (!d.merc || !casa().mercados[d.merc]) return erro('Escolha o mercado.');
      const agora = Date.now();
      const nova = novaAnotacao({ item: d.item, centavos, emb: d.emb, marca: d.marca, merc: d.merc, fonte: meuNome() || 'Alguém', por: meuUid() }, agora);
      fecharFolha();
      fazerPrecos(anotar(S.precos, [[novoIdPreco(agora), nova]], agora), `${casa().itens[d.item]!.nome}: ${reais(centavos)} no ${casa().mercados[d.merc]!.nome}`, true);
    };
  });
}

/* ---------- perguntar ao Claude ---------- */
export function abrirPergunta(): void {
  const c = casa();
  const faltando = itensFaltando(c);
  if (!faltando.length) {
    folha(`<h2>Perguntar ao Claude</h2><p>A lista está vazia. Marque o que acabou em “Em casa” e volte aqui para montar a pergunta.</p><button class="ok" id="fOk">Entendi</button>`, () => { $('fOk').onclick = fecharFolha; });
    return;
  }
  const texto = textoPergunta(c.cidade, faltando, listarMercados(c));
  folha(`<h2>Perguntar ao Claude</h2>
    <p>Esta é a pergunta, já com a sua lista. Dá para mudar o texto antes de mandar.</p>
    <textarea class="pergunta" id="fPerg" aria-label="Pergunta para o Claude">${e(texto)}</textarea>
    <button class="ok" id="fEnviar">Mandar para o Claude</button>
    <p class="nota">Abre o menu de compartilhar do iPhone: escolha o app do Claude e a pergunta já vai escrita. Se não abrir, a pergunta é copiada.</p>
    <button class="cancela" id="fFecha">Fechar</button>`, () => {
    $('fFecha').onclick = fecharFolha;
    const area = $('fPerg') as HTMLTextAreaElement;
    const copiar = (t: string) => {
      const ok = () => { fecharFolha(); avisar('Pergunta copiada. Abra o app do Claude e cole.'); };
      const falhou = () => { area.focus(); area.select(); avisar('Não deu para copiar sozinho. Toque no texto, escolha “Copiar” e abra o app do Claude.'); };
      try { void navigator.clipboard.writeText(t).then(ok, falhou); } catch { falhou(); }
    };
    // O share é chamado direto no toque (sem await antes): o iPhone só deixa abrir o menu assim.
    $('fEnviar').onclick = () => {
      const t = area.value;
      if (typeof navigator.share !== 'function') { copiar(t); return; }
      navigator.share({ text: t }).then(
        () => fecharFolha(),
        (err: unknown) => { if ((err as { name?: string })?.name !== 'AbortError') copiar(t); }, // cancelar o menu não é erro: sem aviso
      );
    };
  });
}

/* ---------- colar a resposta ---------- */
export function abrirColar(): void {
  folha(`<h2>Colar a resposta do Claude</h2>
    <p>No app do Claude, copie a resposta inteira e cole aqui. O app lê a parte que começa com <b>ACABOU</b>.</p>
    <textarea class="pergunta" id="fResp" placeholder="Toque e segure para colar" aria-label="Resposta do Claude"></textarea>
    <div class="erro" id="fErro" role="alert"></div>
    <button class="ok" id="fGuardar">Guardar os preços</button>
    <p class="nota">Cada preço mostra de quando é; depois de ${LIMITES_PRECO.diasValem} dias ele sai da comparação, para ninguém confiar em promoção vencida.</p>
    <button class="cancela" id="fCancela">Cancelar</button>`, () => {
    $('fCancela').onclick = fecharFolha;
    ($('fResp') as HTMLTextAreaElement).oninput = () => { $('fErro').textContent = ''; };
    $('fGuardar').onclick = () => {
      const c = casa();
      const r = lerResposta(($('fResp') as HTMLTextAreaElement).value, listarItens(c), listarMercados(c));
      if (r.erro === 'sem-bloco') { $('fErro').textContent = 'Não achei a parte ACABOU. Confira se colou a resposta inteira.'; return; }
      if (r.erro === 'nada-bate') { $('fErro').textContent = 'Achei a parte ACABOU, mas nenhum preço bate com os produtos.'; return; }
      const agora = Date.now();
      const novas = r.anotacoes.map(a => [novoIdPreco(agora), novaAnotacao({ ...a, fonte: 'Claude', por: meuUid() }, agora)] as [string, ReturnType<typeof novaAnotacao>]);
      const n = r.anotacoes.length, produtos = new Set(r.anotacoes.map(a => a.item)).size;
      fecharFolha();
      fazerPrecos(anotar(S.precos, novas, agora), `${n} ${n === 1 ? 'preço' : 'preços'} de ${produtos} ${produtos === 1 ? 'produto guardado' : 'produtos guardados'}`, true);
    };
  });
}

/* ---------- cidade ---------- */
export function editarCidade(): void {
  textoSheet('Em que cidade vocês fazem compras?', casa().cidade, 'Salvar', v => fazer(definirCidade(v), 'Cidade salva'), LIMITES.cidade);
}
