/** "quando" que aparece embaixo do botão marcado: agora · 7h15 · ontem · há 3 dias */
export function formatarQuando(quando: number, agora: number = Date.now()): string {
  if (!quando) return '';
  const d = new Date(quando), n = new Date(agora);
  const dif = agora - quando;
  if (dif < 90_000) return 'agora';
  const diaD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diaN = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dias = Math.round((diaN - diaD) / 86_400_000);
  if (dias <= 0) return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}
