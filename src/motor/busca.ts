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

/** Para comparar nomes vindos de fora (resposta do Claude): sem acento, sem maiúscula e com o apóstrofo curvo (Sam’s) igual ao reto (Sam's). */
export function normalizarNome(texto: string): string {
  return semAcento(String(texto ?? '').replace(/[\u2018\u2019\u00b4`]/g, "'")).replace(/\s+/g, ' ');
}
