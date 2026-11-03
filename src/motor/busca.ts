/** Busca sem acento e sem maiúscula. */
export function semAcento(texto: string): string {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** O nome contém o que foi digitado? ("acuc" acha "Açúcar cristal") */
export function combina(nome: string, digitado: string): boolean {
  const d = semAcento(digitado);
  return d === '' || semAcento(nome).includes(d);
}

export function mesmoNome(a: string, b: string): boolean {
  return semAcento(a) === semAcento(b);
}
