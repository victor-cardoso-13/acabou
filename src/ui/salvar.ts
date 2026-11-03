/**
 * Guarda o progresso no próprio aparelho (localStorage).
 * Se um dia o conteúdo do jogo for recriado (fases, perguntas…), troque o "v1" da chave.
 * Para sincronizar com a conta (nuvem), veja a seção Firebase do CLAUDE.md.
 */
const CHAVE = 'acabou:v1';

export function carregar<T>(padrao: T): T {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

export function salvar<T>(valor: T) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(valor));
  } catch {
    /* aparelho cheio ou modo privado: o jogo segue sem salvar */
  }
}
